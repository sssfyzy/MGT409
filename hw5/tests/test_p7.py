"""Route integration tests use real MCP transport and disposable shop copies."""

from contextlib import closing
import hashlib
import json
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import tempfile
import time
import unittest

from fastapi.testclient import TestClient
from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import FunctionModel

from backend.agent import AgentTeam, allowed_tool
from backend.config import ROOT
from backend.main import create_app
from backend.models import Role
from mcp_server.approval import issue_payment_approval
from tests.test_p5 import returned_tools, report_response


def fixture_model(messages, info):
    if not returned_tools(messages):
        text = next(str(p.content) for m in messages if isinstance(m, ModelRequest)
                    for p in m.parts if isinstance(p, UserPromptPart))
        tid = int(re.search(r'"id":\s*(\d+)', text).group(1))
        args = {"ticket_id": tid, "kind": {101: "invoice", 102: "rent", 103: "purchase"}[tid]}
        if tid == 103:
            args.update(vendor_id=2, quantity=12)
        return ModelResponse(parts=[ToolCallPart("prepare_payment", args)])
    return report_response(info, "Offline API fixture: proposal prepared, payment not executed")


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="hw5-p7-", dir=ROOT / "data")
        self.db = Path(self.temp.name) / "fixture.db"
        self.audit = Path(self.temp.name) / "audit.json"
        shutil.copy2(ROOT / "data/campus_customs.db", self.db)
        self.key = secrets.token_urlsafe(48)
        self.app = create_app(team_factory=lambda: AgentTeam(
            db_path=self.db, audit_path=self.audit, testing_model=FunctionModel(fixture_model)),
            operator_key=self.key)
        self.client = TestClient(self.app, base_url="http://localhost:8000")
        self.client.__enter__()
        self.headers = {}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def login(self):
        response = self.client.post("/session", json={"access_key": self.key,
                         "display_name": "Offline route-test human"}, headers={"Origin": "http://localhost:5173"})
        self.assertEqual(response.status_code, 200, response.text)
        self.headers = {"X-CSRF-Token": response.json()["csrf_token"], "Origin": "http://localhost:5173"}

    def run_ticket(self, tid):
        response = self.client.post(f"/tickets/{tid}/run", json={"read_only": True}, headers=self.headers)
        self.assertEqual(response.status_code, 202, response.text)
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            job = self.client.get(response.json()["status_url"]).json()
            if job["status"] not in {"queued", "running"}:
                self.assertEqual(job["status"], "completed", job)
                self.assertEqual(job["run_id"], job["result"]["run_id"])
                return job
            time.sleep(0.02)
        self.fail("Offline job did not finish")

    def proposal(self, tid):
        self.run_ticket(tid)
        proposals = self.client.get("/payments/pending").json()["proposals"]
        return next(p for p in proposals if p["action"]["ticket_id"] == tid)

    def approve(self, proposal, **extra):
        return self.client.post("/payments/approve", headers=self.headers,
                json={"action_id": proposal["action_id"], "confirm": True, **extra})

    def test_reads_and_background_run_events(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(len(self.client.get("/tickets").json()["tickets"]), 3)
        self.assertEqual(self.client.get("/cash").json()["account"]["balance"], 3400)
        self.login()
        job = self.run_ticket(102)
        self.assertTrue(job["read_only"])
        first = self.client.get("/events", params={"after": 0, "limit": 3, "run_id": job["run_id"]}).json()
        self.assertEqual(len(first["events"]), 3)
        self.assertTrue(first["has_more"])
        second = self.client.get("/events", params={"after": first["next_after"], "run_id": job["run_id"]}).json()
        self.assertTrue(all(e["sequence"] > first["next_after"] for e in second["events"]))
        self.assertTrue(any(e["event"] == "mcp_tool_result" for e in second["events"]))
        latest = self.client.get("/events", params={"limit": 1}).json()["events"]
        self.assertEqual(latest[0]["event"], "run_end")
        self.assertEqual(self.client.get("/cash").json()["account"]["balance"], 3400)

    def test_auth_csrf_origin_host_and_identity_controls(self):
        self.assertEqual(self.client.post("/reset", json={"confirm": True}).status_code, 401)
        self.assertEqual(self.client.post("/tickets/102/run", json={}).status_code, 401)
        self.assertEqual(self.client.get("/payments/pending").status_code, 401)
        self.assertEqual(self.client.post("/session", json={"access_key": "x" * 48}).status_code, 401)
        self.assertEqual(self.client.post("/session", json={"access_key": self.key, "display_name": "Boss"}).status_code, 422)
        self.assertEqual(self.client.post("/session", json={"access_key": self.key},
                                         headers={"Origin": "https://evil.example"}).status_code, 403)
        self.login()
        self.assertEqual(self.client.post("/reset", json={"confirm": True}).status_code, 403)
        self.assertEqual(self.client.post("/reset", json={"confirm": True},
                 headers={**self.headers, "Origin": "https://evil.example"}).status_code, 403)
        self.assertEqual(self.client.get("/tickets", headers={"Host": "evil.example"}).status_code, 400)
        self.assertFalse(self.client.get("/data/operator_access.json").status_code == 200)

    def test_human_payment_and_duplicate_rejection(self):
        self.login()
        proposal = self.proposal(101)
        # Browser identity cannot override the identity authenticated at session creation.
        self.assertEqual(self.approve(proposal, approved_by="Boss").status_code, 422)
        response = self.approve(proposal)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["approved_by"], "Offline route-test human")
        self.assertEqual(self.client.get("/cash").json()["account"]["balance"], 2560)
        self.assertEqual(self.approve(proposal).status_code, 404)
        with closing(sqlite3.connect(self.db)) as c:
            self.assertEqual(c.execute("SELECT status FROM invoices WHERE id=501").fetchone()[0], "paid")
            self.assertEqual(c.execute("SELECT COUNT(*) FROM payments").fetchone()[0], 1)

    def test_stale_cash_proposal_and_insufficient_cash(self):
        self.login()
        stale_rent = self.proposal(102)
        invoice = self.proposal(101)
        self.assertEqual(self.approve(invoice).status_code, 200)
        self.assertEqual(self.approve(stale_rent).status_code, 409)
        rent = self.proposal(102)
        self.assertEqual(self.approve(rent).status_code, 200)
        purchase = self.proposal(103)
        self.assertIn("Insufficient cash", purchase["blockers"])
        self.assertEqual(self.approve(purchase, confirmed_assumptions=True).status_code, 409)
        self.assertEqual(self.client.get("/cash").json()["account"]["balance"], 160)

    def test_purchase_requires_explicit_assumption_confirmation(self):
        self.login()
        purchase = self.proposal(103)
        self.assertEqual(self.approve(purchase).status_code, 409)
        response = self.approve(purchase, confirmed_assumptions=True)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get("/cash").json()["account"]["balance"], 3136)
        with closing(sqlite3.connect(self.db)) as c:
            self.assertEqual(c.execute("SELECT qty FROM inventory WHERE sku='CC-HOOD-NAVY' AND size='M'").fetchone()[0], 8)

    def test_reset_restores_copy_preserves_audit_and_invalidates_authority(self):
        self.login()
        proposal = self.proposal(102)
        old_token = issue_payment_approval(proposal, "Offline route-test human", self.app.state.team.secret)
        self.assertEqual(self.approve(proposal).status_code, 200)
        history_before = json.loads(self.audit.read_text(encoding="utf-8"))
        original_hash = hashlib.sha256((ROOT / "data/campus_customs.db").read_bytes()).hexdigest()
        reset = self.client.post("/reset", json={"confirm": True}, headers=self.headers)
        self.assertEqual(reset.status_code, 200, reset.text)
        self.assertEqual(reset.json()["generation"], 1)
        self.assertEqual(hashlib.sha256(self.db.read_bytes()).hexdigest(), original_hash)
        self.assertEqual(self.client.get("/payments/pending").json()["proposals"], [])
        self.assertEqual(self.approve(proposal).status_code, 404)
        history_after = json.loads(self.audit.read_text(encoding="utf-8"))
        self.assertEqual(history_after[:len(history_before)], history_before)
        self.assertEqual(history_after[-1]["event"], "database_reset_complete")
        async def replay():
            await self.app.state.team.mcp.client.call_tool("execute_approved_payment", {"approval": old_token})
        with self.assertRaises(Exception):
            self.client.portal.call(replay)
        fresh = self.proposal(102)
        self.assertNotEqual(fresh["action_id"], proposal["action_id"])
        self.assertEqual(self.approve(fresh).status_code, 200)

    def test_busy_run_blocks_other_run_approval_and_reset(self):
        self.login()
        import asyncio
        async def slow(messages, info):
            await asyncio.sleep(0.4)
            return report_response(info)
        from contextlib import ExitStack
        with ExitStack() as stack:
            for agent in self.app.state.team.agents.values():
                stack.enter_context(agent.override(model=FunctionModel(slow)))
            response = self.client.post("/tickets/102/run", json={}, headers=self.headers)
            self.assertEqual(response.status_code, 202)
            self.assertEqual(self.client.post("/tickets/101/run", json={}, headers=self.headers).status_code, 409)
            self.assertEqual(self.client.post("/reset", json={"confirm": True}, headers=self.headers).status_code, 409)
            self.assertEqual(self.client.post("/payments/approve", json={"action_id": "0" * 64, "confirm": True},
                                             headers=self.headers).status_code, 409)
            deadline = time.monotonic() + 10
            while self.client.get(response.json()["status_url"]).json()["status"] in {"queued", "running"}:
                self.assertLess(time.monotonic(), deadline)
                time.sleep(0.02)

    def test_bad_inputs_missing_items_and_logout(self):
        self.login()
        self.assertEqual(self.client.post("/tickets/999/run", json={}, headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get("/runs/unknown").status_code, 404)
        self.assertEqual(self.client.get("/events?limit=201").status_code, 422)
        self.assertEqual(self.client.post("/tickets/102/run", json={"model": "forbidden"}, headers=self.headers).status_code, 422)
        self.assertEqual(self.client.post("/reset", json={"confirm": False}, headers=self.headers).status_code, 422)
        response = self.client.delete("/session", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.client.get("/session").json()["authenticated"])

    def test_agent_cannot_access_reset_or_payment_execution(self):
        for role in Role:
            for read_only in (True, False):
                self.assertFalse(allowed_tool(role, "reset_working_database", read_only))
                self.assertFalse(allowed_tool(role, "execute_approved_payment", read_only))


if __name__ == "__main__":
    unittest.main()
