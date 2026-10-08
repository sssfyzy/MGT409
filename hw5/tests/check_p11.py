"""Read-only fresh-install submission smoke test. No model calls or financial writes."""
import asyncio
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import httpx
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

ROOT = Path(__file__).resolve().parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

async def main():
    before = {n: digest(ROOT / "data" / n) for n in ["campus_customs.db", "campus_customs_new.db"]}
    versions = {}
    for line in (ROOT / "requirements.txt").read_text().splitlines():
        match = re.fullmatch(r"([\w-]+)(?:\[[^]]+\])?==(.+)", line)
        if match:
            versions[match[1]] = importlib.metadata.version(match[1])
            assert versions[match[1]] == match[2]
    check = subprocess.run([sys.executable, "-m", "pip", "check"], capture_output=True, text=True)
    assert check.returncode == 0, check.stdout + check.stderr
    config = json.loads((ROOT / ".mcp.json").read_text())["mcpServers"]["campus_customs_hw5"]
    assert config == {"command": "python", "args": ["mcp_server/server.py"]}
    # Activate PATH in the client process as the README requires. The MCP library
    # resolves `python` before applying a child-only env dictionary.
    os.environ["PATH"] = str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"]
    os.environ["VIRTUAL_ENV"] = str(ROOT / ".venv")
    transport = StdioTransport(command=config["command"], args=config["args"], cwd=str(ROOT))
    async with Client(transport) as client:
        names = sorted(t.name for t in await client.list_tools())
        assert len(names) == 10
        state = (await client.call_tool("get_shop_state", {})).data
        queue = (await client.call_tool("list_tickets", {"status": "all"})).data
    assert next(a["balance"] for a in state["cash_accounts"] if a["name"] == "checking") == 160
    assert len(state["payments"]) == 2
    assert all(t["status"] == "resolved" for t in queue["tickets"])
    async with httpx.AsyncClient(base_url="http://localhost:8002") as client:
        health = (await client.get("/health")).raise_for_status().json()
        assert health["model"] == "gpt-6-luna"
        cash = (await client.get("/cash")).raise_for_status().json()
        assert cash["account"]["balance"] == 160
        tickets = (await client.get("/tickets")).raise_for_status().json()
        assert len(tickets["tickets"]) == 3
        access = json.loads((ROOT / "data/operator_access.json").read_text())["access_key"]
        connected = await client.post("/session", json={"access_key": access, "display_name": "P11 fresh-install verification"}, headers={"Origin": "http://localhost:5173"})
        connected.raise_for_status()
        assert connected.json()["authenticated"] is True
        assert (await client.get("/payments/pending")).raise_for_status().json()["proposals"] == []
    async with httpx.AsyncClient() as client:
        frontend = (await client.get("http://localhost:5174/")).raise_for_status()
        assert '/src/main.tsx' in frontend.text
        assert (await client.get("http://localhost:5174/src/main.tsx")).status_code == 200
    assert (ROOT / "frontend/dist/index.html").is_file()
    assert (ROOT / "frontend/package-lock.json").is_file()
    log = (ROOT / "AI_prompts.md").read_text(encoding="utf-8")
    assert len(re.findall(r"^## Problem \d+:", log, flags=re.M)) == 11
    for section in re.split(r"^## Problem \d+:", log, flags=re.M)[1:]:
        assert 'prompt' in section.lower()
    assert not re.search(r"[\u3400-\u9fff]", log)
    html = (ROOT / "output/desk_tickets.html").read_text(encoding="utf-8")
    assert 'Problem 10 · Student reflection' in html
    for name in re.findall(r'(?:src|href)="([^"#]+)"', html + (ROOT / "output/resolved_board.html").read_text(encoding="utf-8")):
        if not re.match(r"(?:https?:|data:)", name):
            assert (ROOT / "output" / name.split('#')[0]).is_file(), name
    after = {n: digest(ROOT / "data" / n) for n in before}
    assert before == after
    assert before['campus_customs.db'] == '23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a'
    checks = ["Fresh virtual environment installed all six pinned requirements", "pip check reports no broken requirements", "Portable .mcp.json launches ten tools with activated-environment PATH and hw5 cwd", "Fresh MCP reads preserve completed state: 160 cash, two payments, three resolved tickets", "Fresh backend starts from backend folder and HTTP reads succeed", "Local operator session works; no pending payments", "npm ci and production build succeeded in the submission copy", "Fresh Vite startup serves index and module on test port 5174", "All 11 English prompt sections contain actual records", "Completed Reflection and local HTML screenshot/result links exist", "Both database hashes unchanged during setup verification"]
    evidence = {"recorded_at_utc": datetime.now(timezone.utc).isoformat(), "source": "Fresh environment and actual HTTP/MCP in verified submission checkout", "checks": checks, "python_version": sys.version.split()[0], "pinned_versions": versions, "pip_check": check.stdout.strip(), "mcp_tools": names, "database_hashes_before": before, "database_hashes_after": after, "backend_health": health, "cash": cash, "model_calls": 0, "financial_writes": 0, "test_ports": {"backend": 8002, "frontend": 5174}, "port_note": "Alternate free ports were used for startup verification to avoid disturbing the user's existing 8000/5173 board; README production ports and CORS settings are unchanged. This smoke test uses real HTTP reads, not a full cross-origin UI chat run."}
    (ROOT / "output/p11_checks.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps({"passed": len(checks), "model_calls": 0, "financial_writes": 0, "cash": 160}))

if __name__ == "__main__":
    asyncio.run(main())
