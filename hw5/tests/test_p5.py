"""All financial mutations here use disposable copies, never the homework working DB."""

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import tempfile
import unittest
from contextlib import closing

from fastmcp import Client
from fastmcp.client.transports import StdioTransport
from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel

from backend.agent import AgentTeam, allowed_tool
from backend.audit import AuditTrail
from backend.config import ROOT
from backend.models import ExecutionLimits, Role
from mcp_server.approval import issue_payment_approval, sign_capability


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class MCPFinancialTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="campus-hw5-p5-", dir=ROOT / "data")
        self.db = Path(self.temp.name) / "fixture.db"
        shutil.copy2(ROOT / "data/campus_customs.db", self.db)
        self.secret = secrets.token_urlsafe(48)
        self.client = Client(StdioTransport(command=os.sys.executable,
                             args=[str(ROOT / "mcp_server/server.py")],
                             env={"CAMPUS_CUSTOMS_DB_PATH": str(self.db),
                                  "CAMPUS_APPROVAL_SECRET": self.secret,
                                  "FASTMCP_SHOW_BANNER": "false"}, cwd=str(ROOT)))
        await self.client.__aenter__()

    async def asyncTearDown(self):
        await self.client.__aexit__(None, None, None)
        self.temp.cleanup()

    async def call(self, name, **args):
        return (await self.client.call_tool(name, args)).data

    def rows(self, sql, args=()):
        with closing(sqlite3.connect(self.db)) as c:
            return c.execute(sql, args).fetchall()

    async def approve(self, proposal):
        token = issue_payment_approval(proposal, "Offline human-approval fixture", self.secret,
                                       confirmed_assumptions=True)
        return await self.call("execute_approved_payment", approval=token)

    async def test_all_tools_and_read_only_preparation(self):
        names = {t.name for t in await self.client.list_tools()}
        self.assertEqual(len(names), 10)
        before = digest(self.db)
        queue = await self.call("list_tickets", status="open")
        self.assertEqual([t["id"] for t in queue["tickets"]], [101, 102, 103])
        vendor = await self.call("get_vendor_context", vendor_id=1)
        self.assertTrue(vendor["shipment_blocked"])
        self.assertFalse((await self.call("get_vendor_context", vendor_id=999))["found"])
        proposal = await self.call("prepare_payment", ticket_id=101, kind="invoice")
        self.assertEqual(proposal["action"]["amount"], 840)
        self.assertTrue(proposal["ready_for_approval"])
        self.assertEqual(digest(self.db), before)

    async def test_invalid_tampered_expired_approval_refused(self):
        proposal = await self.call("prepare_payment", ticket_id=101, kind="invoice")
        before = digest(self.db)
        valid = issue_payment_approval(proposal, "Fixture human", self.secret)
        expired = sign_capability({"purpose": "payment", "action": proposal["action"],
                                   "approved_by": "Fixture human"}, self.secret, lifetime=-1)
        for token in ("approved", valid + "tampered", expired):
            with self.assertRaises(Exception):
                await self.call("execute_approved_payment", approval=token)
        self.assertEqual(digest(self.db), before)

    async def test_invoice_rent_updates_and_duplicate_refusal(self):
        stale_rent = await self.call("prepare_payment", ticket_id=102, kind="rent")
        invoice = await self.call("prepare_payment", ticket_id=101, kind="invoice")
        receipt = await self.approve(invoice)
        self.assertEqual(receipt["action"]["balance_after"], 2560)
        self.assertEqual(self.rows("SELECT status FROM invoices WHERE id=501"), [("paid",)])
        self.assertFalse((await self.call("get_vendor_context", vendor_id=1))["shipment_blocked"])
        before = digest(self.db)
        with self.assertRaises(Exception):
            await self.approve(invoice)
        with self.assertRaises(Exception):
            await self.approve(stale_rent)
        self.assertEqual(digest(self.db), before)
        rent = await self.call("prepare_payment", ticket_id=102, kind="rent")
        await self.approve(rent)
        self.assertEqual(self.rows("SELECT balance FROM cash_accounts"), [(160.0,)])
        self.assertEqual(len(self.rows("SELECT * FROM payments")), 2)
        self.assertIn("recorded as paid", self.rows("SELECT notes FROM leases")[0][0])
        self.assertEqual(len((await self.call("get_rent_context", ticket_id=102))["rent_payments"]), 1)
        self.assertEqual(self.rows("SELECT status FROM tickets ORDER BY id"), [("open",)] * 3)
        purchase = await self.call("prepare_payment", ticket_id=103, kind="purchase", vendor_id=2, quantity=12)
        self.assertIn("Insufficient cash", purchase["blockers"])
        with self.assertRaises(ValueError):
            issue_payment_approval(purchase, "Fixture human", self.secret, confirmed_assumptions=True)

    async def test_purchase_assumptions_and_no_phantom_inventory(self):
        blocked = await self.call("prepare_payment", ticket_id=101, kind="purchase", vendor_id=1, quantity=1)
        self.assertIn("Vendor has an unpaid invoice and cannot ship", blocked["blockers"])
        with self.assertRaises(Exception):
            await self.call("prepare_payment", ticket_id=103, kind="purchase", vendor_id=2, quantity=13)
        proposal = await self.call("prepare_payment", ticket_id=103, kind="purchase", vendor_id=2, quantity=12)
        self.assertEqual(proposal["action"]["amount"], 264)
        self.assertEqual(len(proposal["assumptions"]), 3)
        with self.assertRaises(ValueError):
            issue_payment_approval(proposal, "Fixture human", self.secret)
        await self.approve(proposal)
        self.assertEqual(self.rows("SELECT balance FROM cash_accounts"), [(3136.0,)])
        self.assertEqual(self.rows("SELECT qty FROM inventory WHERE sku='CC-HOOD-NAVY' AND size='M'"), [(8,)])

    async def test_database_failure_rolls_back_payment_and_cash(self):
        with closing(sqlite3.connect(self.db)) as c, c:
            c.execute("CREATE TRIGGER refuse_invoice BEFORE UPDATE ON invoices BEGIN "
                      "SELECT RAISE(ABORT, 'fixture write failure'); END")
        proposal = await self.call("prepare_payment", ticket_id=101, kind="invoice")
        before = digest(self.db)
        with self.assertRaises(Exception):
            await self.approve(proposal)
        self.assertEqual(self.rows("SELECT balance FROM cash_accounts"), [(3400.0,)])
        self.assertEqual(self.rows("SELECT * FROM payments"), [])
        self.assertEqual(digest(self.db), before)

    async def test_outcomes_require_capability_and_factual_preconditions(self):
        async def outcome(ticket_id, kind):
            action = {"ticket_id": ticket_id, "outcome": "Offline test fixture outcome",
                      "resolution_kind": kind, "expected_status": "open"}
            token = sign_capability({"purpose": "ticket_outcome", "role": "boss", "action": action}, self.secret)
            return await self.call("record_ticket_outcome", **action, write_token=token)
        before = digest(self.db)
        with self.assertRaises(Exception):
            await self.call("record_ticket_outcome", ticket_id=103, outcome="Fake", resolution_kind="declined")
        with self.assertRaises(Exception):
            await outcome(101, "fulfilled")
        with self.assertRaises(Exception):
            await outcome(102, "paid")
        self.assertEqual(digest(self.db), before)
        result = await outcome(103, "declined")
        self.assertEqual(result["ticket"]["status"], "resolved")
        self.assertFalse(result["customer_message_sent"])


def role_from_info(info) -> Role:
    for role, label in [(Role.BOSS, "Boss"), (Role.INVENTORY, "Inventory"),
                        (Role.ACCOUNTING, "Accounting"), (Role.FACILITIES, "Facilities"),
                        (Role.CUSTOMER_SERVICE, "Customer Service")]:
        if info.instructions.startswith("You are the " + label):
            return role
    raise AssertionError("Role prompt not loaded")


def returned_tools(messages):
    return [p for m in messages if isinstance(m, ModelRequest)
            for p in m.parts if isinstance(p, ToolReturnPart)]


def report_response(info, summary="Offline fixture report"):
    return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {"summary": summary})])


class AgentTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="campus-hw5-agents-", dir=ROOT / "data")
        self.db = Path(self.temp.name) / "fixture.db"
        shutil.copy2(ROOT / "data/campus_customs.db", self.db)
        self.audit = ROOT / "output/p5_test_audit.json"

    async def asyncTearDown(self):
        self.temp.cleanup()

    async def test_every_directed_role_pair_and_actual_mcp_callback(self):
        checked = []
        async with AgentTeam(testing_model=TestModel(call_tools=[]), db_path=self.db,
                             audit_path=self.audit) as team:
            for source in Role:
                for target in Role:
                    if source == target:
                        continue
                    def scripted(messages, info):
                        role, tools = role_from_info(info), returned_tools(messages)
                        exposed = {t.name for t in info.function_tools}
                        self.assertNotIn("execute_approved_payment", exposed)
                        self.assertNotIn("record_ticket_outcome", exposed)
                        if role == source and not tools:
                            return ModelResponse(parts=[ToolCallPart("_delegate_task", {
                                "agent_name": target.value, "task": "Read the shop date and current cash via MCP."})])
                        if role == target and not tools:
                            return ModelResponse(parts=[ToolCallPart("get_shop_state", {})])
                        return report_response(info)
                    model = FunctionModel(scripted)
                    from contextlib import ExitStack
                    with ExitStack() as stack:
                        for agent in team.agents.values():
                            stack.enter_context(agent.override(model=model))
                        result = await team.run_ticket(102, start_role=source)
                    self.assertEqual(result.status, "review_ready", result.error)
                    self.assertEqual(set(result.agents_worked), {source, target})
                    events = json.loads(self.audit.read_text(encoding="utf-8"))
                    run_events = [e for e in events if e["run_id"] == result.run_id]
                    self.assertTrue(any(e["event"] == "mcp_tool_result" for e in run_events))
                    self.assertGreaterEqual(result.usage["requests"], 4)
                    checked.append(source.value + " -> " + target.value)
        self.assertEqual(len(checked), 20)
        self.assertEqual(digest(self.db), digest(ROOT / "data/campus_customs.db"))

    async def test_cycles_depth_limits_and_shared_request_budget(self):
        def cycle_model(messages, info):
            if not returned_tools(messages):
                to = "inventory" if role_from_info(info) == Role.BOSS else "boss"
                return ModelResponse(parts=[ToolCallPart("_delegate_task", {"agent_name": to, "task": "Cycle fixture"})])
            return report_response(info)
        async with AgentTeam(testing_model=FunctionModel(cycle_model), db_path=self.db,
                             audit_path=self.audit) as team:
            result = await team.run_ticket(102)
            self.assertEqual(result.status, "review_ready", result.error)
            events = json.loads(self.audit.read_text(encoding="utf-8"))
            self.assertTrue(any(e["run_id"] == result.run_id and e["event"] == "delegation_blocked" for e in events))
        async with AgentTeam(testing_model=FunctionModel(cycle_model), db_path=self.db,
                             audit_path=self.audit, limits=ExecutionLimits(delegation_depth=0)) as team:
            result = await team.run_ticket(102)
            self.assertEqual(result.agents_worked, [Role.BOSS])
        async with AgentTeam(testing_model=FunctionModel(cycle_model), db_path=self.db,
                             audit_path=self.audit, limits=ExecutionLimits(model_requests=1)) as team:
            result = await team.run_ticket(102)
            self.assertEqual(result.status, "blocked", result.error)
            self.assertEqual(result.usage["requests"], 1)

    async def test_payment_proposal_survives_in_public_result(self):
        def scripted(messages, info):
            if not returned_tools(messages):
                return ModelResponse(parts=[ToolCallPart("prepare_payment", {"ticket_id": 102, "kind": "rent"})])
            return report_response(info, "Rent prepared only; not paid")
        async with AgentTeam(testing_model=FunctionModel(scripted), db_path=self.db,
                             audit_path=self.audit) as team:
            result = await team.run_ticket(102, start_role=Role.ACCOUNTING)
            self.assertEqual(result.status, "review_ready", result.error)
            self.assertEqual(len(result.payment_proposals), 1)
            self.assertFalse(result.payment_proposals[0]["executed"])
        self.assertEqual(digest(self.db), digest(ROOT / "data/campus_customs.db"))

    async def test_timeout_and_missing_ticket_are_audited(self):
        model = TestModel(call_tools=[], custom_output_args={"summary": "Offline fixture"})
        async with AgentTeam(testing_model=model, db_path=self.db, audit_path=self.audit,
                             limits=ExecutionLimits(seconds=0.0001)) as team:
            timed = await team.run_ticket(102)
            self.assertEqual(timed.status, "blocked")
        async with AgentTeam(testing_model=model, db_path=self.db, audit_path=self.audit) as team:
            missing = await team.run_ticket(999)
            self.assertEqual(missing.status, "error")
            self.assertIn("does not exist", missing.error)

    async def test_trusted_approval_matches_pending_and_audits_receipt(self):
        def scripted(messages, info):
            if not returned_tools(messages):
                return ModelResponse(parts=[ToolCallPart("prepare_payment", {"ticket_id": 102, "kind": "rent"})])
            return report_response(info)
        async with AgentTeam(testing_model=FunctionModel(scripted), db_path=self.db,
                             audit_path=self.audit) as team:
            with self.assertRaises(ValueError):
                await team.approve_payment({"action_id": "not-pending"}, human_identity="Offline fixture human")
            result = await team.run_ticket(102, start_role=Role.ACCOUNTING)
            proposal = result.payment_proposals[0]
            receipt = await team.approve_payment(proposal, human_identity="Offline fixture human")
            self.assertTrue(receipt["executed"])
            with self.assertRaises(ValueError):
                await team.approve_payment(proposal, human_identity="Offline fixture human")
        events = json.loads(self.audit.read_text(encoding="utf-8"))
        run_events = [e for e in events if e["run_id"] == result.run_id]
        self.assertTrue(any(e["event"] == "payment_executed" for e in run_events))

    async def test_shared_mcp_call_limit_stops_before_execution(self):
        def scripted(messages, info):
            return ModelResponse(parts=[ToolCallPart("get_shop_state", {})])
        async with AgentTeam(testing_model=FunctionModel(scripted), db_path=self.db,
                             audit_path=self.audit, limits=ExecutionLimits(tool_calls=1)) as team:
            result = await team.run_ticket(102)
            self.assertEqual(result.status, "blocked", result.error)
            events = json.loads(self.audit.read_text(encoding="utf-8"))
            self.assertFalse(any(e["run_id"] == result.run_id and e["event"] == "mcp_tool_result" for e in events))


class AuditAndPermissionTests(unittest.TestCase):
    def test_agent_payment_execution_is_denied_for_all_roles(self):
        for role in Role:
            for read_only in (False, True):
                self.assertFalse(allowed_tool(role, "execute_approved_payment", read_only))
            self.assertFalse(allowed_tool(role, "record_ticket_outcome", True))

    def test_append_preserves_events_and_redacts_secrets(self):
        with tempfile.TemporaryDirectory(prefix="campus-audit-", dir=ROOT / "data") as directory:
            path = Path(directory) / "audit.json"
            audit = AuditTrail(path)
            audit.append(run_id="first", ticket_id=101, agent="boss", event="fixture")
            first = json.loads(path.read_text())
            audit.append(run_id="second", ticket_id=102, agent="accounting", event="fixture",
                         data={"approval": "private-token", "write_token": "private-token"})
            events = json.loads(path.read_text())
            self.assertEqual(events[:1], first)
            self.assertEqual(events[1]["sequence"], 2)
            self.assertNotIn("private-token", path.read_text())


if __name__ == "__main__":
    unittest.main()
