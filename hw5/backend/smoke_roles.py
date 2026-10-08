"""Narrow, read-only live checks for remaining role behavior and proposal preparation."""

import asyncio
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.agent import AgentTeam
from backend.config import ROOT
from backend.models import Role


async def main():
    tasks = [
        (Role.INVENTORY, 101, "For this narrow read-only verification, use "
         "get_order_fulfillment_context to report the exact stock shortage, linked invoice, "
         "vendor lead time and sourcing uncertainty. Return your report directly unless "
         "a missing fact genuinely requires delegation."),
        (Role.CUSTOMER_SERVICE, 101, "For this narrow read-only verification, use "
         "get_order_fulfillment_context and return a customer-message draft explaining "
         "the recorded availability and conditional timing. Do not promise a confirmed "
         "delivery or contact the customer. No financial action is requested."),
        (Role.ACCOUNTING, 102, "For this narrow read-only verification, use "
         "get_rent_context and prepare_payment to prepare the linked rent proposal. "
         "Preparation is read-only and is permitted in this review. Report the amount, "
         "balance before and hypothetical balance after, and required human approval. "
         "Return your report without executing a payment."),
    ]
    results = []
    async with AgentTeam() as team:
        for role, ticket_id, task in tasks:
            result = await team.run_ticket(ticket_id, start_role=role, task=task, read_only=True)
            results.append({"verification_task": task, "result": result.model_dump(mode="json")})
            print(json.dumps({"role": role.value, "status": result.status,
                              "requests": result.usage.get("requests"), "error": result.error}))
    evidence = {"source": "portkey_live", "model": "gpt-6-luna", "read_only": True, "runs": results}
    (ROOT / "output/p5_live_roles.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    raise SystemExit(0 if all(r["result"]["status"] == "review_ready" for r in results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
