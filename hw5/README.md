# MGT409 HW5 — Campus Customs Multi-Agent Operations

Five PydanticAI agents (Boss, Inventory, Accounting, Facilities, Customer Service) collaborate through a FastMCP server. A FastAPI backend and React/Vite/TypeScript board display actual ticket runs, MCP evidence, payment proposals, human authorization, and recorded outcomes. Production uses only **`gpt-6-luna` through Portkey**; there is no model/provider fallback.

## Included submission and recorded state

The repository contains this project under `hw5/`, alongside the unchanged `hw4/` submission. Both supplied databases are included as required by HW5:

- `data/campus_customs.db`: untouched original, starting checking $3,400 and three open tickets.
- `data/campus_customs_new.db`: completed P9 working copy, checking $160. Ticket 101 is resolved with a deferred disposition, ticket 102 is resolved as paid, and ticket 103 is resolved with a deferred disposition. Deferred is not fulfilled; inventory did not arrive or change.

`output/desk_tickets.html` opens directly in a browser and contains Expected, Actual, Cash, and the student's Reflection tabs. `output/resolved_board.html` opens directly with its three local screenshot files; keep the whole `output/` folder together. Detailed outcomes and authorization provenance are in `resolved_tickets.json`; observed live runs, including failed attempts, remain in `audit_trail.json`. Earlier offline fixture evidence is clearly labeled and is not presented as a live outcome.

## Install (Windows PowerShell)

Use Python 3.12 or newer and a supported modern Node.js/npm. Verified locally with Python 3.12.14 and Node 24.20.0. Start in the cloned repository's `hw5` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location frontend
npm ci
npm run build
Set-Location ..
```

Pinned Python dependencies are in `requirements.txt`; frontend dependencies are pinned in `frontend/package.json` and `frontend/package-lock.json`.

Copy `.env.example` to `.env` and privately enter your own `PORTKEY_API_KEY`, or set it in your environment. Optional virtual-key/provider routing and the local operator key are explained in the example. Never commit `.env` or any key. Tests with offline model doubles do not call Portkey.

## Start MCP

For a standalone stdio MCP client, activate the environment and start your client with **working directory `hw5/`**. `.mcp.json` uses `python` and `mcp_server/server.py`, so it is portable under that working directory with the environment's Python on PATH. For clients with another working directory, replace the two paths with your own absolute virtual-environment Python and server paths; do not use the original student's machine paths.

```powershell
.\.venv\Scripts\Activate.ps1
```

If local PowerShell policy prevents activation, configure your MCP client with the absolute `.venv\Scripts\python.exe` path instead; changing machine policy is not required. On Unix, use `.venv/bin/python` and your client's corresponding working-directory configuration.

To start the stdio server manually from `hw5/`:

```powershell
.\.venv\Scripts\python.exe mcp_server\server.py
```

This process waits for an MCP client on stdin/stdout; it is not an HTTP server. The backend creates its own shared stdio MCP subprocess automatically, so a separate manually running server is not required for the dashboard. All shop queries and mutations go through MCP. The original database is rejected as a working database.

## Start FastAPI (terminal 1)

From `hw5/backend/`:

```powershell
..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The backend starts its agent team and MCP connection through lifespan. Use one worker without reload so in-memory sessions and pending proposals stay in one instance. `http://localhost:8000/health` checks availability; `/docs` shows the API.

Startup creates a private `data/operator_access.json`, unless `CAMPUS_OPERATOR_KEY` is set. This file is ignored and never served as shop data. Read its local code to connect through the dashboard with your own display name. Rebooting rotates the code/authority and discards in-memory jobs and pending proposals; durable ticket state and audit history remain.

## Start React board (terminal 2)

From `hw5/frontend/`:

```powershell
npm run dev
```

Open `http://localhost:5173`. The frontend calls `http://localhost:8000`; use the same `localhost` hostname for cookies. Vite's port is strict, and backend origins are restricted to the local configured ports. Connect as an operator before running or resetting tickets. Review-only is initially checked; uncheck it for an authorized resolution run. A finished investigation is not automatically a resolved ticket.

Agents can prepare payments but cannot approve/execute them. The human workflow checks the exact proposal, local session, CSRF, signed capability, current cash and duplicates. A purchase requires separately confirmed supplier/quote assumptions. Payment never implies received stock. Messages are drafts, not delivered email. This is an assignment simulation; no banking service is connected.

## Clean working copy and full three-ticket run

The included working database intentionally preserves the completed P9 results. **Reset it before testing a fresh full run of tickets 101, 102 and 103**, and note the starting $3,400 checking balance. Preferred method: connect to the running board, choose Reset scenario, and confirm. This restores the original, invalidates pending proposals, and preserves append-only audit history.

Alternatively, with the backend and any other MCP processes stopped, copy the original over the working copy from `hw5/`:

```powershell
Copy-Item -LiteralPath data\campus_customs.db -Destination data\campus_customs_new.db
```

Only do this when deliberately requesting a clean scenario, because it overwrites the working results. Never overwrite or mutate `campus_customs.db`. Restart the backend afterward. Do not copy a database while a process is writing to it, and do not erase the audit to hide preceding attempts.

In a fresh run, use the board for each ticket, review exact payment proposals, and explicitly authorize the workflow before any simulated spending. `desk.date_today` is the scenario business date for deadlines; `payments.paid_at` records the actual UTC commit time of a run. Do not invalidate a committed payment merely because the clocks differ, or claim that its actual timestamp proves historically on-time payment.

## Verification

From `hw5/`, these checks use disposable database copies and offline model doubles where a model is needed:

```powershell
.\.venv\Scripts\python.exe -m tests.run_checks
.\.venv\Scripts\python.exe -m tests.run_p7_checks
.\.venv\Scripts\python.exe -m unittest tests.test_p9
```

`tests/verify_p9_state.py` is a read-only verification of the included completed working state; it expects all three resolved and $160 cash, so it will intentionally fail after a reset until those results exist again. Browser-evidence scripts need Playwright and Chromium (`npm install --no-save playwright` in a separate test runtime, then `npx playwright install chromium`); they are not required to start the app. Financial browser scripts document the historical student-authorized P9 workflow and must not be executed blindly as general-purpose approval automation.

Actual P4 native MCP evidence is `output/mcp_smoke.json`. P9 reconciliation and independent read-only SQLite verification are `output/p9_state_verification.json`. P10's nine browser checks are in `output/p10_checks.json`. P11 submission checks are added in `output/p11_checks.json`. For the complete schema, tools, roles, API, dashboard, safety boundaries and test provenance, see `output/harness.md`.

## Submission

The public repository URL is recorded in `output/github_url.txt` and is the URL to submit to Canvas. The Git ignore rules include exactly the two required database files from `data/`, while excluding environment/operator secrets, temporary fixture data, `.venv`, dependencies and frontend build output.
