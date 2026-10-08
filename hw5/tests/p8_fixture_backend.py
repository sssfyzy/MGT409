"""Real P7 backend on port 8001, with a disposable DB and offline model fixture."""

import asyncio
import json
from pathlib import Path
import re
import secrets
import shutil
import tempfile

from pydantic_ai.messages import ModelRequest, ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import FunctionModel
from backend.agent import AgentTeam
from backend.config import ROOT
from backend.main import create_app
from tests.test_p5 import returned_tools, role_from_info

temporary = tempfile.TemporaryDirectory(prefix="hw5-p8-browser-", dir=ROOT / "data")
fixture = Path(temporary.name)
database = fixture / "fixture.db"
shutil.copy2(ROOT / "data/campus_customs.db", database)
access_file = fixture / "operator.json"
key = secrets.token_urlsafe(48)
(ROOT / "data/p8_fixture_meta.json").write_text(json.dumps({
    "database": str(database), "access_file": str(access_file), "audit_file": str(fixture / "audit.json"),
    "source": "Disposable database + real API/MCP + offline model fixture"}), encoding="utf-8")


async def scripted(messages, info):
    await asyncio.sleep(0.22)  # Allow the real UI to observe activity between actual tool steps.
    role = role_from_info(info).value
    text = next(str(p.content) for m in messages if isinstance(m, ModelRequest)
                for p in m.parts if isinstance(p, UserPromptPart))
    match = re.search(r'"id":\s*(\d+)', text)
    tid = int(match.group(1)) if match else int(re.search(r'ticket (\d+)', text).group(1))
    tools = returned_tools(messages)
    by_name = {t.tool_name: t.content for t in tools}
    context_tool = {101: "get_order_fulfillment_context", 102: "get_rent_context", 103: "get_bulk_discount_context"}[tid]
    def call(name, args):
        return ModelResponse(parts=[ToolCallPart(name, args)])
    if context_tool not in by_name:
        return call(context_tool, {"ticket_id": tid})
    context = by_name[context_tool]
    if isinstance(context, list):
        context = context[0]
    if role == "boss" and "_delegate_task" not in by_name:
        specialist = "facilities" if tid == 102 else "accounting"
        return call("_delegate_task", {"agent_name": specialist, "task": f"Review ticket {tid} and prepare its financial proposal. This is an offline browser test fixture."})
    if role == "facilities" and "_delegate_task" not in by_name:
        return call("_delegate_task", {"agent_name": "accounting", "task": f"Check ticket {tid} cash and prepare rent only if it has not been paid."})
    paid = bool(context.get("rent_payments")) if tid == 102 else context.get("linked_invoice", {}).get("status") == "paid" if tid == 101 else False
    if role == "accounting" and not paid and "prepare_payment" not in by_name:
        args = {"ticket_id": tid, "kind": {101: "invoice", 102: "rent", 103: "purchase"}[tid]}
        if tid == 103:
            args.update(vendor_id=2, quantity=12)
        return call("prepare_payment", args)
    if role == "boss" and tid == 102 and paid and 'operational ticket updates allowed' in text and "record_ticket_outcome" not in by_name:
        return call("record_ticket_outcome", {"ticket_id": tid, "outcome": "Offline browser fixture: rent payment verified through MCP.", "resolution_kind": "paid"})
    summary = f"Offline browser fixture: {role} reviewed ticket {tid} using real MCP records."
    facts = []
    if tid == 102:
        facts = [f"Recorded rent: {context['lease']['monthly_rent']}; due {context['lease']['next_due']}.",
                 f"Recorded rent payments: {len(context.get('rent_payments', []))}."]
    elif context.get("stock"):
        facts = [f"Recorded size stock: {context['stock']['qty']}; requested {context['ticket']['qty']}."]
    return call(info.output_tools[0].name, {"summary": summary, "facts": facts,
         "recommendation": "Review the prepared proposal before authorizing money movement." if not paid else "The payment record is verified.",
         "needs_human_decision": not paid})


app = create_app(team_factory=lambda: AgentTeam(testing_model=FunctionModel(scripted),
                 db_path=database, audit_path=fixture / "audit.json"), operator_key=key,
                 access_file=access_file)

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="127.0.0.1", port=8001)
    finally:
        temporary.cleanup()
