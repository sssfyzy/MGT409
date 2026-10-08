# Campus Customs operations team — Problem 5

`agent.py` creates the five PydanticAI agents from their student-approved prompt files. `models.py` defines their structured reports, execution limits, and team result. `config.py` creates only `gpt-6-luna` through Portkey. `audit.py` preserves and appends real run events. Shop facts and database changes are available only through the shared stdio MCP connection.

## Local setup

From the HW5 root, install the pinned dependencies into `.venv` with `.venv\Scripts\python.exe -m pip install -r requirements.txt`. Set `PORTKEY_API_KEY` in your local environment, or copy `.env.example` to the ignored `.env` and fill it in locally. Never put the real key in source files. Optional `PORTKEY_VIRTUAL_KEY` routing is supported; the model cannot be changed by an environment variable and there is no provider/model fallback.

From the `backend` folder, run a read-only investigation:

```powershell
..\.venv\Scripts\python.exe run_team.py --ticket 102 --save ..\output\p5_live_smoke.json
```

The CLI never performs a payment or resolves a ticket. Live model calls append to `output/audit_trail.json`; its existing history is retained. Saved evidence is separate from the audit. `smoke_roles.py` provides three narrow live checks for Inventory, Customer Service, and Accounting, while `run_team.py` can start with Boss or any named role.

## Delegation and approval

Every role has the same delegation interface and can call any other role. Each child returns to its caller. The team shares model/token/tool limits across the delegation tree, rejects a return to an ancestor, and enforces depth and elapsed-time limits. The agent's output contains recommendations; observed contributions, prepared proposals, and usage are also captured by the runtime.

Payment proposals remain in the team's pending-proposal store. `AgentTeam.approve_payment` is a trusted application method, not an agent tool. Its future P7 caller must verify an authenticated human click; a browser-supplied approver name alone is insufficient. The method checks the exact pending proposal, creates an expiring signature, calls the MCP execution tool, and audits approval and execution/refusal. Restarting the team discards pending proposals and rotates its private secret, so re-preparation is required.

P5 established the team and approval boundary. P7 now supplies `main.py` routes; the dashboard belongs to P8. Full ticket resolution belongs to P9, after the student-approved expected plans in P6.

## Verification

From the HW5 root, run `.venv\Scripts\python.exe -m tests.run_checks`. Offline PydanticAI doubles exercise all 20 directed role pairs through real MCP transport. Financial tests mutate only disposable database copies and check invalid approvals, stale proposals, duplicate payments, insufficient funds, rollback, purchase assumptions, and factual outcome preconditions. Their events are kept in `output/p5_test_audit.json`, separately from real Portkey runs.

## P7 FastAPI backend

From `backend/`, start one local server:

```powershell
..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The course's `uvicorn main:app --reload --port 8000` command also works with the virtual environment active. Verification uses one worker without reload so operator sessions and pending proposals remain in one team instance. The server starts and closes its MCP connection through FastAPI lifespan.

The route list is in `output/harness.md`. Ticket runs return a run ID immediately, allowing the dashboard to poll status and agent events. Review mode defaults to `read_only: true`; a later authorized resolution run can use `read_only: false`. Runs, approval, and reset cannot overlap. Payments remain unavailable to agents in either mode.

Startup saves a private operator access code to ignored `data/operator_access.json`, unless a private `CAMPUS_OPERATOR_KEY` is configured locally. Connect through `POST /session` with that code and a human display name. The access file is not served over HTTP or given to agents. This local-owner mechanism is for the assignment, not a production identity system. The session uses an eight-hour HttpOnly, SameSite-Strict cookie. Control requests require `X-CSRF-Token`, an allowed local origin, and the session. Use the same hostname for frontend and backend; the future dashboard runs on port 5173.

`POST /payments/approve` accepts only the current pending action ID, `confirm: true`, and optional explicit purchase-assumption confirmation. It obtains the approver identity from the trusted session; the browser cannot supply the amount, payee, or approver identity. Re-preparing an obligation replaces its old pending proposal. Execution rechecks cash and obligation state inside the MCP transaction.

`POST /reset` requires an operator and `confirm: true`. Its restricted MCP tool restores the working copy, preserves audit history, and rotates write authority. Pending proposals are cleared, fresh proposal IDs differ, and old signed tokens are invalid. Historical job results retain their database-generation number.

Run `.venv\Scripts\python.exe -m tests.run_p7_checks` from the HW5 root for disposable-database API and financial tests; results are saved in `output/p7_checks.json`. With the server running, `python -m tests.check_p7_http` checks real localhost HTTP reads and operator sessions using the same virtual environment. It records `output/p7_http_smoke.json` and makes no external model call, payment, reset, or ticket-resolution request.
