"""Campus Customs shop tools. Database access lives exclusively in this MCP server."""

from __future__ import annotations

from contextlib import closing
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
import sqlite3
import os
import hashlib
import hmac
import shutil
import tempfile
import time
from typing import Any, Literal

from fastmcp import FastMCP

if __package__:
    from .approval import canonical, verify_capability
else:
    from approval import canonical, verify_capability


DB_PATH = Path(os.getenv("CAMPUS_CUSTOMS_DB_PATH", str(
    Path(__file__).resolve().parents[1] / "data" / "campus_customs_new.db"
))).resolve()
if DB_PATH.name == "campus_customs.db":
    raise ValueError("The MCP server must never use the original database")
mcp = FastMCP("Campus Customs Operations")


def _connect() -> sqlite3.Connection:
    """Open only the HW5 working copy; never create or write a database."""
    if not DB_PATH.is_file():
        raise FileNotFoundError(f"Working database not found: {DB_PATH}")
    connection = sqlite3.connect(f"{DB_PATH.resolve().as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def _write_connect() -> sqlite3.Connection:
    if not DB_PATH.is_file():
        raise FileNotFoundError("Working database not found")
    connection = sqlite3.connect(f"{DB_PATH.as_uri()}?mode=rw", uri=True, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _shop_date(connection: sqlite3.Connection) -> str:
    rows = connection.execute("SELECT date_today FROM desk LIMIT 2").fetchall()
    if len(rows) != 1:
        raise ValueError("Expected exactly one shop date in desk")
    return str(rows[0]["date_today"])


def _ticket(
    connection: sqlite3.Connection, ticket_id: int, expected_type: str | None = None
) -> dict[str, Any]:
    if ticket_id <= 0:
        raise ValueError("ticket_id must be positive")
    row = connection.execute(
        "SELECT id, type, requester, subject, sku, size, qty, lease_id, "
        "invoice_id, status, notes, created_at FROM tickets WHERE id = ?",
        (ticket_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Ticket {ticket_id} does not exist")
    if expected_type is not None and row["type"] != expected_type:
        raise ValueError(
            f"Ticket {ticket_id} is {row['type']!r}, not {expected_type!r}"
        )
    return dict(row)


def _stock(
    connection: sqlite3.Connection, sku: str | None, size: str | None
) -> dict[str, Any]:
    if not sku or not size:
        return {"found": False, "sku": sku, "size": size, "qty": None}
    row = connection.execute(
        "SELECT sku, name, size, qty, location FROM inventory "
        "WHERE sku = ? AND size = ?",
        (sku, size),
    ).fetchone()
    if row is None:
        return {"found": False, "sku": sku, "size": size, "qty": None}
    return {"found": True, **dict(row)}


def _shortfall(requested: int | None, stock: dict[str, Any]) -> int | None:
    if requested is None or stock["qty"] is None:
        return None
    return max(requested - stock["qty"], 0)


def _days_until(due_date: str, shop_date: str) -> int | None:
    try:
        return (date.fromisoformat(due_date) - date.fromisoformat(shop_date)).days
    except ValueError:
        return None


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


@mcp.tool()
def get_order_fulfillment_context(ticket_id: int) -> dict[str, Any]:
    """Read stock and linked vendor-invoice context for a customer-order ticket.

    Ticket 101 needs this to distinguish a zero-stock size from an unknown
    SKU/size and to see the open invoice that may block a reprint shipment.
    """
    with closing(_connect()) as connection:
        ticket = _ticket(connection, ticket_id, "customer_order")
        stock = _stock(connection, ticket["sku"], ticket["size"])
        invoice = None
        if ticket["invoice_id"] is not None:
            row = connection.execute(
                "SELECT i.id, i.vendor_id, i.amount, i.due_date, i.status, "
                "i.description, v.name AS vendor_name, "
                "v.specialty AS vendor_specialty, v.lead_days AS vendor_lead_days "
                "FROM invoices AS i LEFT JOIN vendors AS v ON v.id = i.vendor_id "
                "WHERE i.id = ?",
                (ticket["invoice_id"],),
            ).fetchone()
            invoice = (
                {"found": True, **dict(row)}
                if row is not None
                else {"found": False, "id": ticket["invoice_id"]}
            )
        return {
            "shop_date": _shop_date(connection),
            "ticket": ticket,
            "stock": stock,
            "stock_shortfall": _shortfall(ticket["qty"], stock),
            "linked_invoice": invoice,
        }


@mcp.tool()
def get_rent_context(ticket_id: int) -> dict[str, Any]:
    """Read the lease, due date, and cash balances for a rent-notice ticket.

    Ticket 102 needs this context before any rent payment is proposed; this
    tool does not approve, make, or record a payment.
    """
    with closing(_connect()) as connection:
        ticket = _ticket(connection, ticket_id, "rent_notice")
        shop_date = _shop_date(connection)
        lease = None
        if ticket["lease_id"] is not None:
            row = connection.execute(
                "SELECT id, space_name, landlord, monthly_rent, next_due, "
                "notes FROM leases WHERE id = ?",
                (ticket["lease_id"],),
            ).fetchone()
            lease = (
                {"found": True, **dict(row),
                 "days_until_due": _days_until(row["next_due"], shop_date)}
                if row is not None
                else {"found": False, "id": ticket["lease_id"]}
            )
        cash_accounts = [
            dict(row)
            for row in connection.execute(
                "SELECT name, balance, date FROM cash_accounts ORDER BY name"
            )
        ]
        return {
            "shop_date": shop_date,
            "ticket": ticket,
            "lease": lease,
            "cash_accounts": cash_accounts,
            "rent_payments": [dict(row) for row in connection.execute(
                "SELECT * FROM payments WHERE kind = 'rent' AND ref_id = ?",
                (ticket["lease_id"],),
            )],
        }


@mcp.tool()
def get_bulk_discount_context(ticket_id: int) -> dict[str, Any]:
    """Read size stock and price/cost context for a price-override ticket.

    Ticket 103 needs the requested-versus-available quantity and the current
    list-price margin before a human considers a bulk discount.
    """
    with closing(_connect()) as connection:
        ticket = _ticket(connection, ticket_id, "price_override")
        stock = _stock(connection, ticket["sku"], ticket["size"])
        pricing = None
        if ticket["sku"]:
            row = connection.execute(
                "SELECT sku, unit_cost, list_price FROM pricing WHERE sku = ?",
                (ticket["sku"],),
            ).fetchone()
            if row is not None:
                pricing = {"found": True, **dict(row)}
                unit_margin = Decimal(str(row["list_price"])) - Decimal(
                    str(row["unit_cost"])
                )
                pricing["unit_gross_margin_at_list_price"] = _money(unit_margin)
            else:
                pricing = {"found": False, "sku": ticket["sku"]}
        return {
            "shop_date": _shop_date(connection),
            "ticket": ticket,
            "stock": stock,
            "stock_shortfall": _shortfall(ticket["qty"], stock),
            "pricing": pricing,
        }


@mcp.tool()
def list_tickets(status: Literal["open", "resolved", "all"] = "all") -> dict[str, Any]:
    """Read the shop ticket queue. Status filtering never changes a ticket."""
    with closing(_connect()) as connection:
        rows = connection.execute("SELECT * FROM tickets ORDER BY id") if status == "all" else \
            connection.execute("SELECT * FROM tickets WHERE status = ? ORDER BY id", (status,))
        return {"shop_date": _shop_date(connection), "tickets": [dict(r) for r in rows]}


@mcp.tool()
def get_shop_state() -> dict[str, Any]:
    """Read the shop date, cash accounts, and recorded payments."""
    with closing(_connect()) as connection:
        return {"shop_date": _shop_date(connection),
                "cash_accounts": [dict(r) for r in connection.execute(
                    "SELECT * FROM cash_accounts ORDER BY name")],
                "payments": [dict(r) for r in connection.execute(
                    "SELECT * FROM payments ORDER BY id")]}


@mcp.tool()
def get_vendor_context(vendor_id: int) -> dict[str, Any]:
    """Read vendor lead time and all unpaid invoices; specialty is not a SKU mapping."""
    with closing(_connect()) as connection:
        row = connection.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,)).fetchone()
        if row is None:
            return {"found": False, "vendor_id": vendor_id}
        invoices = [dict(r) for r in connection.execute(
            "SELECT * FROM invoices WHERE vendor_id = ? ORDER BY id", (vendor_id,))]
        unpaid = [r for r in invoices if r["status"] != "paid"]
        return {"found": True, "shop_date": _shop_date(connection), "vendor": dict(row),
                "invoices": invoices, "unpaid_invoices": unpaid,
                "shipment_blocked": bool(unpaid), "sku_supplier_mapping_verified": False}


def _amount(value: Any) -> Decimal:
    amount = Decimal(str(value))
    if not amount.is_finite() or amount <= 0 or amount != amount.quantize(Decimal("0.01")):
        raise ValueError("Amount must be positive, finite, and expressed to cents")
    return amount


def _payment_proposal(connection: sqlite3.Connection, ticket_id: int, kind: str,
                      account: str, vendor_id: int | None, quantity: int | None) -> dict:
    ticket = _ticket(connection, ticket_id)
    if ticket["status"] != "open":
        raise ValueError("Payment proposals require an open ticket")
    cash = connection.execute("SELECT * FROM cash_accounts WHERE name = ?", (account,)).fetchone()
    if cash is None:
        raise ValueError("Unknown cash account")
    blockers, assumptions = [], []
    details: dict[str, Any] = {}
    if kind == "invoice":
        if ticket["invoice_id"] is None:
            raise ValueError("Ticket has no linked invoice")
        bill = connection.execute("SELECT * FROM invoices WHERE id = ?", (ticket["invoice_id"],)).fetchone()
        if bill is None:
            raise ValueError("Linked invoice missing")
        ref_id, amount = bill["id"], _amount(bill["amount"])
        vendor = connection.execute("SELECT * FROM vendors WHERE id = ?", (bill["vendor_id"],)).fetchone()
        if vendor is None:
            raise ValueError("Invoice vendor missing")
        details = {"payee": vendor["name"], "due_date": bill["due_date"]}
        if bill["status"] != "open":
            blockers.append("Invoice is not open")
    elif kind == "rent":
        if ticket["lease_id"] is None:
            raise ValueError("Ticket has no linked lease")
        lease = connection.execute("SELECT * FROM leases WHERE id = ?", (ticket["lease_id"],)).fetchone()
        if lease is None:
            raise ValueError("Linked lease missing")
        ref_id, amount = lease["id"], _amount(lease["monthly_rent"])
        details = {"payee": lease["landlord"], "due_date": lease["next_due"]}
    elif kind == "purchase":
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise ValueError("Purchase quantity must be a positive integer")
        stock = _stock(connection, ticket["sku"], ticket["size"])
        if not stock["found"]:
            raise ValueError("Unknown SKU/size")
        pricing = connection.execute("SELECT * FROM pricing WHERE sku = ?", (ticket["sku"],)).fetchone()
        vendor = connection.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,)).fetchone()
        if pricing is None or vendor is None:
            raise ValueError("Purchase pricing or vendor missing")
        if ticket["qty"] is None or quantity > _shortfall(ticket["qty"], stock):
            raise ValueError("Purchase quantity exceeds this ticket's recorded shortfall")
        amount, ref_id = _amount(Decimal(str(pricing["unit_cost"])) * quantity), ticket_id
        details = {"payee": vendor["name"], "vendor_id": vendor_id, "quantity": quantity,
                   "sku": ticket["sku"], "size": ticket["size"],
                   "unit_cost": pricing["unit_cost"], "lead_days": vendor["lead_days"]}
        if connection.execute("SELECT 1 FROM invoices WHERE vendor_id = ? AND status != 'paid'",
                              (vendor_id,)).fetchone():
            blockers.append("Vendor has an unpaid invoice and cannot ship")
        assumptions = ["Vendor-to-SKU match is not established by the database",
                       "Recorded unit cost is an estimate, not a confirmed vendor quote",
                       "This is a simulated purchase; payment does not record receipt of inventory"]
    else:
        raise ValueError("Unsupported payment kind")
    if connection.execute("SELECT 1 FROM payments WHERE kind = ? AND ref_id = ?", (kind, ref_id)).fetchone():
        blockers.append("This obligation already has a payment record")
    balance = Decimal(str(cash["balance"]))
    if not balance.is_finite() or balance < amount:
        blockers.append("Insufficient cash")
    action = {"ticket_id": ticket_id, "kind": kind, "ref_id": ref_id, "account": account,
              "amount": _money(amount), "shop_date": _shop_date(connection),
              "balance_before": _money(balance), "balance_after": _money(balance - amount),
              "details": details}
    action_id = hmac.new(os.getenv("CAMPUS_APPROVAL_SECRET", "readonly").encode(),
                         b"proposal:" + canonical(action), hashlib.sha256).hexdigest()
    return {"action_id": action_id, "action": action,
            "ready_for_approval": not blockers, "requires_human_approval": True,
            "blockers": blockers, "assumptions": assumptions, "executed": False}


@mcp.tool()
def prepare_payment(ticket_id: int, kind: Literal["invoice", "rent", "purchase"],
                    account: str = "checking", vendor_id: int | None = None,
                    quantity: int | None = None) -> dict[str, Any]:
    """Read a payment/purchase proposal; does not approve, persist, or execute money movement."""
    with closing(_connect()) as connection:
        return _payment_proposal(connection, ticket_id, kind, account, vendor_id, quantity)


@mcp.tool()
def execute_approved_payment(approval: str) -> dict[str, Any]:
    """Trusted human workflow only. Signed, expiring approval is required; never expose to agents."""
    payload = verify_capability(approval, os.getenv("CAMPUS_APPROVAL_SECRET", ""), "payment")
    action, approved_by = payload["action"], payload.get("approved_by", "")
    if not isinstance(approved_by, str) or not approved_by.strip():
        raise ValueError("Human approver missing")
    with closing(_write_connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        details = action["details"]
        fresh = _payment_proposal(connection, action["ticket_id"], action["kind"],
                                  action["account"], details.get("vendor_id"), details.get("quantity"))
        if not fresh["ready_for_approval"]:
            raise ValueError("Payment refused: " + "; ".join(fresh["blockers"]))
        if fresh["action"] != action:
            raise ValueError("Payment proposal is stale; request fresh human approval")
        if fresh["assumptions"] and not payload.get("confirmed_assumptions"):
            raise ValueError("Purchase assumptions were not confirmed by the human")
        timestamp = datetime.now(timezone.utc).isoformat()
        cursor = connection.execute(
            "INSERT INTO payments(kind, ref_id, amount, account, paid_at, approved_by) VALUES (?, ?, ?, ?, ?, ?)",
            (action["kind"], action["ref_id"], action["amount"], action["account"], timestamp, approved_by))
        connection.execute("UPDATE cash_accounts SET balance = ?, date = ? WHERE name = ?",
                           (action["balance_after"], action["shop_date"], action["account"]))
        if action["kind"] == "invoice":
            connection.execute("UPDATE invoices SET status = 'paid' WHERE id = ?", (action["ref_id"],))
        elif action["kind"] == "rent":
            note = f"Rent due {details['due_date']} recorded as paid in payment {cursor.lastrowid}."
            connection.execute("UPDATE leases SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? "
                               "ELSE notes || char(10) || ? END WHERE id = ?", (note, note, action["ref_id"]))
        return {"executed": True, "payment_id": cursor.lastrowid, "action": action,
                "approved_by": approved_by, "paid_at": timestamp,
                "inventory_received": False}


@mcp.tool()
def record_ticket_outcome(ticket_id: int, outcome: str,
                          resolution_kind: Literal["fulfilled", "paid", "declined", "deferred"],
                          expected_status: str = "open", write_token: str = "") -> dict[str, Any]:
    """Boss-only final operational step, with backend capability and factual preconditions."""
    action = {"ticket_id": ticket_id, "outcome": outcome, "resolution_kind": resolution_kind,
              "expected_status": expected_status}
    payload = verify_capability(write_token, os.getenv("CAMPUS_APPROVAL_SECRET", ""), "ticket_outcome")
    if payload.get("action") != action or payload.get("role") != "boss":
        raise ValueError("Invalid Boss write capability")
    if not outcome.strip() or len(outcome) > 4000:
        raise ValueError("A concise, nonempty outcome is required")
    with closing(_write_connect()) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        ticket = _ticket(connection, ticket_id)
        if expected_status != "open" or ticket["status"] != expected_status:
            raise ValueError("Ticket is not open or has changed")
        if resolution_kind == "paid":
            kind, ref_id = ("rent", ticket["lease_id"]) if ticket["type"] == "rent_notice" else \
                ("invoice", ticket["invoice_id"])
            if ref_id is None or not connection.execute(
                "SELECT 1 FROM payments WHERE kind = ? AND ref_id = ?", (kind, ref_id)).fetchone():
                raise ValueError("Cannot claim paid without a payment record")
        elif resolution_kind == "fulfilled":
            if ticket["type"] not in {"customer_order", "price_override"} or not ticket["qty"]:
                raise ValueError("Ticket cannot be fulfilled from inventory")
            stock = _stock(connection, ticket["sku"], ticket["size"])
            if stock["qty"] is None or stock["qty"] < ticket["qty"]:
                raise ValueError("Cannot fulfill with insufficient stock")
            connection.execute("UPDATE inventory SET qty = qty - ? WHERE sku = ? AND size = ?",
                               (ticket["qty"], ticket["sku"], ticket["size"]))
        note = f"Outcome ({resolution_kind}): {outcome.strip()}"
        connection.execute("UPDATE tickets SET status = 'resolved', notes = CASE "
                           "WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END WHERE id = ?",
                           (note, note, ticket_id))
        return {"ticket": _ticket(connection, ticket_id), "resolution_kind": resolution_kind,
                "customer_message_sent": False}


@mcp.tool()
def reset_working_database(reset_token: str) -> dict[str, Any]:
    """Trusted human workflow only: restore the working copy and rotate write authority."""
    payload = verify_capability(reset_token, os.getenv("CAMPUS_APPROVAL_SECRET", ""), "reset")
    next_secret = payload.get("next_secret", "")
    if not isinstance(next_secret, str) or len(next_secret) < 32 or next_secret == os.getenv("CAMPUS_APPROVAL_SECRET"):
        raise ValueError("Reset requires fresh private write authority")
    if not payload.get("approved_by"):
        raise ValueError("Human reset identity missing")
    original = Path(__file__).resolve().parents[1] / "data" / "campus_customs.db"
    if DB_PATH == original.resolve() or not original.is_file() or not DB_PATH.is_file():
        raise ValueError("Reset requires an existing separate working copy")
    if any(Path(str(DB_PATH) + suffix).exists() for suffix in ("-wal", "-shm", "-journal")):
        raise ValueError("Reset refused while SQLite sidecar files indicate another transaction")
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    with closing(sqlite3.connect(original.as_uri() + "?mode=ro", uri=True)) as source:
        if source.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Original database integrity check failed")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=DB_PATH.parent, prefix="hw5-reset-", suffix=".db", delete=False) as f:
            temporary = Path(f.name)
        shutil.copyfile(original, temporary)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != original_hash:
            raise ValueError("Reset source changed during copy")
        for attempt in range(6):
            try:
                os.replace(temporary, DB_PATH)
                break
            except PermissionError:
                if attempt == 5:
                    raise
                time.sleep(0.05 * (attempt + 1))
        os.environ["CAMPUS_APPROVAL_SECRET"] = next_secret
        with closing(_connect()) as c:
            return {"reset": True, "database_sha256": original_hash,
                    "shop_date": _shop_date(c),
                    "cash_accounts": [dict(r) for r in c.execute("SELECT * FROM cash_accounts")],
                    "pending_actions_invalidated": True, "audit_history_preserved": True}
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


if __name__ == "__main__":
    mcp.run(show_banner=False, log_level="CRITICAL")
