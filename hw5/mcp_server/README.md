# Campus Customs MCP server (Problems 3–7)

`server.py` defines a FastMCP server for the HW5 operations agents. Its default database is `../data/campus_customs_new.db`, the working copy of the supplied SQLite database. All shop queries and mutations occur in this server. The original `campus_customs.db` is rejected. An explicit `CAMPUS_CUSTOMS_DB_PATH` override allows tests to use disposable copies. Reads use SQLite read-only mode; authorized writes use transactions and bound SQL parameters.

| Tool | Ticket | What it returns |
| --- | --- | --- |
| `get_order_fulfillment_context(ticket_id)` | 101 | The customer-order ticket, SKU/size stock and shortfall, linked invoice, vendor, and shop date. |
| `get_rent_context(ticket_id)` | 102 | The rent ticket, lease and due date, cash-account balances, and shop date. |
| `get_bulk_discount_context(ticket_id)` | 103 | The discount ticket, SKU/size stock and shortfall, unit cost, list price, list-price unit gross margin, and shop date. |
| `list_tickets(status)` | All | Ticket queue filtered by `open`, `resolved`, or `all`; includes shop date. |
| `get_shop_state()` | All | Shop date, recorded cash balances, and payments. |
| `get_vendor_context(vendor_id)` | Sourcing | Vendor details, lead time, invoices, unpaid-invoice shipment block, and a warning that a supplier-to-SKU mapping is not established. |
| `prepare_payment(ticket_id, kind, account, vendor_id, quantity)` | Financial proposals | Read-only proposal for an invoice, rent, or estimated purchase; recorded inputs, hypothetical cash change, approval requirement, blockers, and assumptions. |
| `execute_approved_payment(approval)` | Human workflow only | Verifies a signed approval, rechecks the proposal inside a write transaction, records a payment, reduces cash, and updates the linked invoice or lease notes. Never exposed to an agent. |
| `record_ticket_outcome(ticket_id, outcome, resolution_kind, expected_status, write_token)` | Boss operational mode | Requires a backend-signed Boss capability, an open ticket, and paid/fulfillment preconditions. Records a resolved outcome; `fulfilled` also consumes available stock atomically. Disabled during P5 read-only runs. |
| `reset_working_database(reset_token)` | Human workflow only | Restores the working copy from the original, checks its source integrity/hash, rotates private write authority, and preserves audit history. Never exposed to agents. |

The original three context tools also work for later tickets of the same type. They reject a missing ticket or the wrong ticket type, and they mark a missing linked record as unknown rather than treating it as zero or paid. `get_rent_context` now also returns recorded rent payments.

FastMCP is the Python dependency; the current local environment uses the pinned version in `../requirements.txt`. From the HW5 root, `python -m pip install -r requirements.txt` recreates the dependency in an appropriate Python environment.

For Problem 4, `.mcp.json` originally recorded the verified local absolute launch paths. For P11 submission it now uses `python` and `mcp_server/server.py`: activate the virtual environment and start the MCP client with working directory `hw5/`. If your client cannot set that working directory, replace these paths with your own absolute environment Python and server paths. It contains no credentials. The server itself resolves its database relative to `server.py`, so database resolution is independent of the client's working directory. Historical P4 evidence remains unchanged.

The assistant session used for P4 exposed the three native `campus_customs_hw5` MCP tools through the registered user-level server. The ignored, machine-local `.codex/config.toml` also contains a project-scoped configuration for clients that load it. Client configuration differs between Codex and ChatGPT Work; a local Codex configuration file alone does not establish a Work connection. The verified evidence is the actual native MCP calls captured in `../output/mcp_smoke.json`, not an assumption about which client loads which file.

All three calls succeeded on 2026-10-06. Their complete structured outputs and raw MCP responses are saved with the student-approved questions. An independent read-only SQLite comparison verified every output field, and both database SHA-256 hashes remained unchanged. P4 creates no payments or ticket resolutions.

## P5 agents and payment boundary

The five PydanticAI agents connect through their own shared stdio `MCPToolset`; they do not import the server's database functions. All roles can query facts and delegate to any other role, subject to cycle/depth limits. Only Accounting and Boss can prepare payments. Only Boss in explicitly enabled operational mode can record a ticket outcome. `execute_approved_payment` is excluded from every agent tool list.

`approval.py` contains signing helpers, not shop queries. The backend gives its server subprocess a private, per-team `CAMPUS_APPROVAL_SECRET`; the native general-purpose server has payment execution disabled unless supplied a valid secret. A later trusted human route must establish an authenticated approval click and approve a matching pending proposal before issuing the signed capability. Tokens expire after five minutes, bind the complete action, and are not placed in agent prompts or audit output. Replayed, stale, insufficient-cash, or duplicate payments are refused. P5 implements this boundary but not the P7 human route or P8 dashboard.

The supplied database has no purchase-order or receipt table. Purchases are estimated from recorded unit cost and require explicit human confirmation of supplier/quote assumptions. Paying does not add inventory. Payment references are defined in `output/harness.md`; the rent duplicate rule deliberately supports this assignment's single lease cycle. No future rent date is invented.

Run offline integration checks from the HW5 root with `.venv\Scripts\python.exe -m tests.run_checks`. They use real MCP transport and disposable SQLite copies; payment approvals are labeled test fixtures. Actual model-run evidence and append-only audit records are documented in the harness.

## P7 update

The server now has ten tools. `backend/main.py` supplies the human approval and reset routes described in the harness. Payment and reset execution remain excluded from all agents. Reset requires a signed, expiring human capability, restores only the working path, and rotates the private secret. Prepared action IDs are deterministic for an action under the current server authority; rotating that authority makes pre-reset action IDs stale as well as invalidating old execution tokens. Re-preparing an obligation replaces its previous pending proposal in the backend.
