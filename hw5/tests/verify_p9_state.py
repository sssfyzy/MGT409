"""Read-only final-state reconciliation; does not run models or mutate shop data."""
import asyncio
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

ROOT = Path(__file__).resolve().parents[1]

async def main():
    transport = StdioTransport(command=sys.executable, args=[str(ROOT / "mcp_server/server.py")], cwd=str(ROOT))
    async with Client(transport) as client:
        state = (await client.call_tool("get_shop_state", {})).data
        queue = (await client.call_tool("list_tickets", {"status": "all"})).data
        tee = (await client.call_tool("get_order_fulfillment_context", {"ticket_id": 101})).data
        hoodies = (await client.call_tool("get_bulk_discount_context", {"ticket_id": 103})).data
    original = ROOT / "data/campus_customs.db"
    working = ROOT / "data/campus_customs_new.db"
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    assert original_hash == "23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a"
    # Independent read-only SQLite confirmation of the MCP-backed cash result.
    with closing(sqlite3.connect(working.as_uri() + "?mode=ro", uri=True)) as connection:
        cash_sqlite = connection.execute("SELECT balance FROM cash_accounts WHERE name = 'checking'").fetchone()[0]
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        stock_rows = connection.execute("SELECT sku, size, qty FROM inventory ORDER BY sku, size").fetchall()
    with closing(sqlite3.connect(original.as_uri() + "?mode=ro", uri=True)) as connection:
        original_stock = connection.execute("SELECT sku, size, qty FROM inventory ORDER BY sku, size").fetchall()
    cash_mcp = next(a["balance"] for a in state["cash_accounts"] if a["name"] == "checking")
    assert cash_sqlite == cash_mcp == 160
    assert integrity == "ok"
    assert stock_rows == original_stock, "No stock receipt or fulfillment decrement was authorized"
    assert len(state["payments"]) == 2
    assert sorted((p["kind"], p["amount"]) for p in state["payments"]) == [("invoice", 840), ("rent", 2400)]
    assert 3400 - sum(p["amount"] for p in state["payments"]) == cash_sqlite
    assert sorted((t["id"], t["status"]) for t in queue["tickets"]) == [(101, "resolved"), (102, "resolved"), (103, "resolved")]
    evidence = {"recorded_at_utc": datetime.now(timezone.utc).isoformat(), "source": "Actual working database via fresh read-only MCP client; independent SQLite mode=ro cash/integrity check", "shop_state": state, "queue": queue, "tee_context": tee, "hoodie_context": hoodies, "cash_sqlite": cash_sqlite, "cash_mcp": cash_mcp, "integrity": integrity, "inventory_unchanged": True, "original_database_sha256": original_hash, "checks": ["Original database preserved", "MCP and SQLite checking match at 160", "Exactly one invoice and one rent payment, no duplicate or purchase", "3400 - 840 - 2400 = 160", "All three ticket status rows resolved", "Inventory unchanged", "SQLite integrity ok"]}
    (ROOT / "output/p9_state_verification.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print("P9 verified: cash 160; invoice 840; rent 2400; 3 resolved tickets; no stock changes; original preserved")

if __name__ == "__main__":
    asyncio.run(main())
