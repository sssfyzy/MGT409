"""Offline model + real MCP regression for shared P9 context. No production writes."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import FunctionModel
from backend.agent import AgentTeam
from backend.config import ROOT
from backend.models import Role
from tests.test_p5 import digest, report_response, returned_tools, role_from_info

class SharedContextTests(unittest.IsolatedAsyncioTestCase):
    async def test_verified_context_and_clock_semantics_reach_delegated_role(self):
        with tempfile.TemporaryDirectory(prefix="hw5-p9-regression-", dir=ROOT / "data") as temporary:
            db = Path(temporary) / "fixture.db"
            audit = Path(temporary) / "audit.json"
            shutil.copy2(ROOT / "data/campus_customs.db", db)
            before = digest(db)
            observed = {}
            def scripted(messages, info):
                role = role_from_info(info)
                text = '\n'.join(str(p.content) for m in messages if isinstance(m, ModelRequest) for p in m.parts if isinstance(p, UserPromptPart))
                observed[role.value] = text
                if role == Role.BOSS and not returned_tools(messages):
                    return ModelResponse(parts=[ToolCallPart('_delegate_task', {"agent_name": "accounting", "task": "Use shared current facts to assess affordability without repeating stock/cash reads."})])
                return report_response(info, "Offline verification report; no payment or outcome writes")
            async with AgentTeam(testing_model=FunctionModel(scripted), db_path=db, audit_path=audit) as team:
                result = await team.run_ticket(103, read_only=False)
            self.assertEqual(result.status, 'review_ready', result.error)
            for role in ['boss', 'accounting']:
                self.assertIn('Shared current MCP results', observed[role])
                self.assertIn('get_bulk_discount_context', observed[role])
                self.assertIn('get_shop_state', observed[role])
                self.assertIn('actual UTC commit timestamp', observed[role])
                self.assertIn('CC-HOOD-NAVY', observed[role])
            events = json.loads(audit.read_text(encoding='utf-8'))
            reads = [e['data']['tool'] for e in events if e['event'] == 'mcp_context']
            self.assertEqual(reads, ['list_tickets', 'get_bulk_discount_context', 'get_shop_state'])
            self.assertEqual(digest(db), before)
            self.assertEqual(result.usage['requests'], 3)

if __name__ == '__main__':
    unittest.main()
