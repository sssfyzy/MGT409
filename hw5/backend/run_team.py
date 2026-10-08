"""Read-only P5 CLI. Human payment routes and full resolution come later."""

import argparse
import asyncio
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.agent import AgentTeam
from backend.models import Role


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticket", type=int, required=True)
    parser.add_argument("--role", choices=[r.value for r in Role], default="boss")
    parser.add_argument("--save", type=Path, help="Optional JSON evidence file under output/")
    args = parser.parse_args()
    async with AgentTeam() as team:
        result = await team.run_ticket(args.ticket, read_only=True, start_role=Role(args.role))
        if args.save:
            destination = args.save.resolve()
            output_dir = Path(__file__).resolve().parents[1] / "output"
            if destination.parent != output_dir.resolve():
                raise ValueError("Save the evidence in this homework's output folder")
            destination.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        if result.status != "review_ready":
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
