"""Preserve actual fixture audit/state evidence before temporary test cleanup."""
from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import sqlite3
from backend.config import ROOT

meta = json.loads((ROOT / "data/p8_fixture_meta.json").read_text(encoding="utf-8"))
database = Path(meta["database"]).resolve()
if ROOT / "data" not in database.parents or database.name != "fixture.db":
    raise ValueError("Unexpected fixture path")
with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)) as c:
    c.row_factory = sqlite3.Row
    state = {table: [dict(r) for r in c.execute("SELECT * FROM " + table)]
             for table in ("cash_accounts", "payments", "inventory", "tickets")}
assert state["cash_accounts"][0]["balance"] == 3136
assert len(state["payments"]) == 1 and state["payments"][0]["amount"] == 264
assert next(r for r in state["inventory"] if r["sku"] == "CC-HOOD-NAVY" and r["size"] == "M")["qty"] == 8
shutil.copyfile(meta["audit_file"], ROOT / "output/p8_fixture_audit.json")
(ROOT / "output/p8_fixture_state.json").write_text(json.dumps({
    "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
    "source": "Disposable browser-test database; not the homework working database", "state": state,
    "purchase_did_not_add_inventory": True}, indent=2), encoding="utf-8")
print("Fixture evidence preserved: balance 3136, one 264 purchase, hoodie stock still 8")
