# HW5 system harness

This is a living reference for the Campus Customs multi-agent operations project. Problem 2 documents the supplied SQLite database; later problems can add the MCP tools, agents, routes, and tests.

## Database source and handling

- The HW5 course data pack supplied `data/campus_customs.db`. This is a different database from HW4's storefront data and contains nine business tables.
- `data/campus_customs.db` is the untouched original. `data/campus_customs_new.db` is a byte-for-byte working copy for later problems. Both passed SQLite `PRAGMA integrity_check` at the end of Problem 2; their SHA-256 hashes matched (`23686A90D698F7FA6F901A3F0A9774DB9CBB31E13151C9E5717275F3321F360A`).
- `desk.date_today` is `2026-08-31`. Use this shop date, not the computer's current date, when interpreting due dates. Date and timestamp values are stored as text.
- The field descriptions below are grounded in the schema and current rows. A name or likely use is not treated as a guaranteed business rule where the schema does not define one.

## Tables and fields

### `desk` — 1 row

Why it matters: gives agents the shop's reference date for overdue and upcoming work.

| Field | Observed definition | Use |
| --- | --- | --- |
| `date_today` | `TEXT NOT NULL` | Shop's current date; currently `2026-08-31`. |
| `notes` | nullable `TEXT` | Optional desk-level notes; currently empty. |

There is no declared primary key or constraint limiting this table to one row.

### `tickets` — 3 rows

Why it matters: the agents' work queue; each row describes a request and may point to stock, a lease, or an invoice.

| Field | Observed definition | Use |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Unique ticket identifier (`101`–`103` in the supplied data). |
| `type` | `TEXT NOT NULL` | Work category; observed values are `customer_order`, `rent_notice`, and `price_override`. |
| `requester` | `TEXT NOT NULL` | Person or organization that raised the ticket. |
| `subject` | `TEXT NOT NULL` | Short human-readable topic. |
| `sku` | nullable `TEXT` | Product identifier when the ticket concerns merchandise; no declared foreign key. |
| `size` | nullable `TEXT` | Requested product size when applicable; pair with `sku` to inspect inventory. |
| `qty` | nullable `INTEGER` | Requested quantity when applicable. |
| `lease_id` | nullable `INTEGER`, foreign key to `leases.id` | Links a facilities/rent ticket to a lease. |
| `invoice_id` | nullable `INTEGER`, foreign key to `invoices.id` | Links a ticket to a vendor invoice. |
| `status` | `TEXT NOT NULL` | Ticket state; all three supplied rows are `open`. |
| `notes` | nullable `TEXT` | Additional request details. |
| `created_at` | `TEXT NOT NULL` | Creation timestamp; the current values include a UTC offset. |

### `inventory` — 10 rows

Why it matters: lets agents check whether a requested SKU and size can be fulfilled and identify shortages.

| Field | Observed definition | Use |
| --- | --- | --- |
| `sku` | `TEXT NOT NULL`, part of composite primary key | Product identifier shared with `pricing.sku` and merchandise tickets. |
| `name` | `TEXT NOT NULL` | Product name for human-readable decisions and drafts. |
| `size` | `TEXT NOT NULL`, part of composite primary key | Size variant; includes `S`, `M`, `L`, `XL`, and `OS` in current data. |
| `qty` | `INTEGER NOT NULL` | Recorded quantity for that SKU/size; zero appears for the white tee in S and the crest mug in OS. |
| `location` | `TEXT NOT NULL` | Stock location, such as `Aisle A`. |

The primary key is (`sku`, `size`), so inventory is tracked by that pair. The schema does not separately track reserved quantity or incoming stock.

### `pricing` — 4 rows

Why it matters: provides the cost and list-price inputs for margin and discount analysis.

| Field | Observed definition | Use |
| --- | --- | --- |
| `sku` | `TEXT PRIMARY KEY` | Product identifier used to match an inventory or ticket SKU; no declared foreign key. |
| `unit_cost` | `REAL NOT NULL` | Recorded per-unit cost. |
| `list_price` | `REAL NOT NULL` | Recorded normal selling price. |

### `vendors` — 3 rows

Why it matters: identifies potential suppliers and their recorded lead times when agents consider restocking.

| Field | Observed definition | Use |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Unique vendor identifier, referenced by `invoices.vendor_id`. |
| `name` | `TEXT NOT NULL` | Vendor name for invoice and sourcing context. |
| `specialty` | `TEXT NOT NULL` | Free-text description of supplied service or goods, such as `apparel reprint`. |
| `lead_days` | `INTEGER NOT NULL` | Recorded number of lead-time days. |

### `invoices` — 1 row

Why it matters: shows vendor bills and their status; an unpaid invoice can affect whether the vendor will ship again under the assignment's shop rules.

| Field | Observed definition | Use |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Unique invoice identifier; ticket `101` references invoice `501`. |
| `vendor_id` | `INTEGER NOT NULL`, foreign key to `vendors.id` | Identifies the vendor owed. |
| `amount` | `REAL NOT NULL` | Amount recorded as due on the invoice. |
| `due_date` | `TEXT NOT NULL` | Due date to compare with `desk.date_today`. |
| `status` | `TEXT NOT NULL` | Invoice state; the supplied invoice is `open`. |
| `description` | nullable `TEXT` | Explanation of the bill; invoice `501` concerns a rush reprint of `CC-TEE-WHITE` size S. |

### `leases` — 1 row

Why it matters: supplies the space, landlord, rent amount, and next due date for facilities work.

| Field | Observed definition | Use |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Unique lease identifier; rent ticket `102` references lease `1`. |
| `space_name` | `TEXT NOT NULL` | Name of the leased shop space. |
| `landlord` | `TEXT NOT NULL` | Landlord or property company. |
| `monthly_rent` | `REAL NOT NULL` | Recorded monthly rent amount. |
| `next_due` | `TEXT NOT NULL` | Next rent due date. |
| `notes` | nullable `TEXT` | Optional lease details; currently empty. |

### `cash_accounts` — 1 row

Why it matters: gives Accounting the available recorded balance before any proposed payment.

| Field | Observed definition | Use |
| --- | --- | --- |
| `name` | `TEXT PRIMARY KEY` | Account identifier; currently `checking`. |
| `balance` | `REAL NOT NULL` | Recorded balance; currently `3400.0`. |
| `date` | `TEXT NOT NULL` | Date recorded with the balance; currently `2026-08-31`. |

### `payments` — 0 rows

Why it matters: is the intended record of payments after human approval; it is empty in the original database.

| Field | Observed definition | Use suggested by field name; not yet evidenced by rows |
| --- | --- | --- |
| `id` | `INTEGER PRIMARY KEY` | Payment record identifier. |
| `kind` | `TEXT NOT NULL` | Apparent payment category; allowed values are not defined. |
| `ref_id` | nullable `INTEGER` | Apparent reference to the item being paid; no foreign key defines its target. |
| `amount` | `REAL NOT NULL` | Amount of a recorded payment. |
| `account` | `TEXT NOT NULL` | Apparent cash-account name; no declared foreign key to `cash_accounts.name`. |
| `paid_at` | `TEXT NOT NULL` | Payment timestamp or date; exact format is not established by data. |
| `approved_by` | `TEXT NOT NULL` | Recorded human approver; valid identity/format is not specified. |

## Three open tickets and their links

1. **Ticket 101 — customer order, Bulldog tee.** Requests one `CC-TEE-WHITE` in size S. `inventory` has (`CC-TEE-WHITE`, `S`) with `qty = 0`, while `pricing` gives unit cost `8.0` and list price `28.0`. Its declared `invoice_id = 501` points to an `open` `840.0` invoice due `2026-08-28` for a rush reprint; that invoice's `vendor_id = 1` points to Bulldog Print Co (`apparel reprint`, `lead_days = 5`). The invoice is three calendar days past the shop date. Under the assignment's stated rule, the open unpaid invoice matters before expecting another shipment from that vendor.
2. **Ticket 102 — rent notice.** `lease_id = 1` points to the Chapel Street shop lease with Elm City Properties, `monthly_rent = 2400.0`, and `next_due = 2026-09-02`, two calendar days after the shop date. `cash_accounts` records `checking` at `3400.0`. There is no payment row yet; later payment actions require human approval under the assignment rules.
3. **Ticket 103 — bulk hoodie discount.** Requests 20 `CC-HOOD-NAVY` hoodies in size M. `inventory` records only 8 of that SKU/size, a shortfall of 12 against the requested quantity. `pricing` records `unit_cost = 22.0` and `list_price = 58.0` for margin analysis. The ticket has no `lease_id` or `invoice_id` link.

## Meanings and constraints that remain unclear

- `tickets.sku` and `pricing.sku` match `inventory.sku` by convention, but neither is protected by a declared foreign key. A future tool should validate SKU/size matches explicitly.
- `tickets.status` and `invoices.status` have no documented allowed-value list or database `CHECK` constraint. Only `open` is observed here.
- `payments` has no example rows and no declared links for `kind`, `ref_id`, or `account`; later implementation must define and verify how invoice and rent payments are represented before writing records. `approved_by` is required but the database does not specify an approver identity scheme.
- `inventory.qty` appears to be recorded stock, but the schema does not say whether units can be reserved. It has no separate reserved, incoming, or purchase-order quantity.
- `vendors.specialty` is descriptive text, not an explicit vendor-to-SKU mapping. The data does not by itself prove which vendor can supply every SKU.
- `desk` currently has one row but no key or single-row constraint. `cash_accounts.date` is present, but the schema does not define whether it is an as-of date or transaction date.
- Monetary columns are `REAL` values with no currency column. The current data and assignment context support comparisons, but the database alone does not formally encode a currency.

## Problem 3: Initial MCP server tools

`mcp_server/server.py` defines a FastMCP server pointed at the HW5 **working copy**, `data/campus_customs_new.db`. Its database connections use SQLite read-only mode and `PRAGMA query_only`; every ticket ID, SKU, size, lease ID, and invoice ID is used through a bound SQL parameter. The three initial tools do not alter the database. They are defined here but are not connected to the vibe coder or launched in Problem 3.

| Tool and input | Tables read | Ticket it helps unlock and why |
| --- | --- | --- |
| `get_order_fulfillment_context(ticket_id)` | `tickets`, `inventory`, `invoices`, `vendors`, `desk` | **101:** reads the requested white tee in size S against its actual zero stock, then follows `invoice_id = 501` to the open Bulldog Print Co invoice and vendor lead time. This exposes both the immediate fulfillment shortfall and the invoice that matters before another vendor shipment. |
| `get_rent_context(ticket_id)` | `tickets`, `leases`, `cash_accounts`, `desk` | **102:** follows `lease_id = 1` to the `2026-09-02` rent due date and `2400.0` monthly rent, alongside the shop date and `checking` balance. The agent can prepare a rent recommendation without pretending this read-only tool approves or pays it. |
| `get_bulk_discount_context(ticket_id)` | `tickets`, `inventory`, `pricing`, `desk` | **103:** compares the request for 20 navy hoodies in size M with 8 recorded on hand (shortfall 12), and returns the recorded unit cost and list price plus their calculated per-unit gross margin. This is the concrete stock-and-margin basis for evaluating the requested discount. |

Each tool accepts an integer `ticket_id`, checks that the ticket exists and has the expected `type`, and returns structured fields rather than an invented narrative. A missing SKU/size row is reported as **not found**, not `qty = 0`; a missing linked invoice, lease, or price row is likewise identified explicitly. The gross margin is a calculation from recorded `list_price - unit_cost`, not a new database fact or an approved discount. No payment, purchase order, customer message, or final ticket resolution is performed here.

### Problem 3 verification

The Python file passed syntax parsing. Calling the three functions directly against the working database returned ticket 101's one-unit stock shortfall and open invoice, ticket 102's two days until rent and `3400.0` cash balance, and ticket 103's 12-unit shortfall and `36.0` per-unit gross margin at list price. A wrong-type ticket call raised an error. The working database SHA-256 hash was unchanged after these read-only checks. The FastMCP package is not installed in this isolated test runtime, so its live tool registration and transport have **not** been tested; Problem 4 is the planned connection and live-tool-test stage.

## Problem 4: Connected MCP smoke tests

FastMCP 4.0.11 is now installed in the HW5 `.venv`. The project-root `.mcp.json` records the actual local Python executable and server file used for the stdio connection; these paths must be adapted on another computer. The resumed assistant session exposed the three native `campus_customs_hw5` MCP tools, and each was called with its student-approved question on 2026-10-06. These were MCP tool calls, separate from the direct Python-function checks recorded under Problem 3.

`output/mcp_smoke.json` contains each approved prompt, tool name, arguments, complete structured output, and raw MCP response. The prompts were drafted by the assistant and approved by the student; their origin is identified in the evidence. No separate agent-team audit run is claimed at this stage.

| MCP tool | Verified result |
| --- | --- |
| `get_order_fulfillment_context(101)` | White tee, size S: stock 0, request 1, shortfall 1. Invoice 501 is open for 840.0 and due 2026-08-28; Bulldog Print Co has recorded lead time 5 days. |
| `get_rent_context(102)` | Lease 1: rent 2400.0, due 2026-09-02, two days after the shop date 2026-08-31. Checking balance: 3400.0. |
| `get_bulk_discount_context(103)` | Navy hoodie, size M: request 20, stock 8, shortfall 12. Unit cost 22.0, list price 58.0; calculated unit gross margin at list price 36.0. |

An independent SQLite connection in read-only mode compared every returned ticket, stock, invoice/vendor, lease, cash-account, and pricing field with the working database. It also checked the calculated shortfalls, date difference, gross margin, and agreement between structured output and the raw MCP text. All comparisons passed; SQLite integrity was `ok`. The original and working database hashes both remain `23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a`, matching their pre-test value. No payment, discount approval, or ticket update occurred.

## Problem 5: PydanticAI agent team

The five role prompts were drafted by the assistant and explicitly approved by the student before being written to `backend/prompts/`. They are loaded into five separate PydanticAI `Agent` instances in `backend/agent.py`; `backend/models.py` defines `Role`, `AgentReport`, `TeamResult`, `HumanApprovalRequest`, and `ExecutionLimits`.

| Role / prompt file | Responsibility |
| --- | --- |
| Boss / `boss.md` | Reads the ticket, chooses useful specialists, reconciles evidence, and returns a supported recommendation and required human decisions. |
| Inventory / `inventory.md` | Checks exact SKU/size stock, shortfalls, conditional vendor lead times, and uncertain supplier matches. |
| Accounting / `accounting.md` | Checks cash and invoices, calculates margins, and prepares proposals for human approval. |
| Facilities / `facilities.md` | Checks lease/rent obligations against the shop date and delegates financial checks when useful. |
| Customer Service / `customer_service.md` | Produces customer-facing drafts based on verified facts, with conditional timing and no unsupported promises. |

Every agent can delegate to any of the other four via the same delegation tool. This is full connectivity, not a fixed Boss-to-specialist-only graph. The runtime blocks self/ancestor cycles and excessive depth. Specialists return their reports to the caller; the Boss need not contact every specialist on every ticket. All child runs share the same usage budget. A failed or limited run records the error and preserves completed contributions in `TeamResult`.

Production calls use **only `gpt-6-luna` through Portkey**, loaded from the environment or ignored root `.env`. `PORTKEY_API_KEY` is required. No alternative model or direct-provider fallback is configured. The live gateway responses identify the provider's deployment as `gpt-6-luna-global`; the requested model in source and every production agent is `gpt-6-luna`. Offline test doubles are identified separately and make no model API calls.

### All nine MCP tools and their tables

| Tool | Tables / operation | Agent availability |
| --- | --- | --- |
| `get_order_fulfillment_context` | Reads `desk`, `tickets`, `inventory`, `invoices`, `vendors`. | All roles. |
| `get_rent_context` | Reads `desk`, `tickets`, `leases`, `cash_accounts`, and now `payments`. | All roles. |
| `get_bulk_discount_context` | Reads `desk`, `tickets`, `inventory`, `pricing`; computes margin and shortage. | All roles. |
| `list_tickets` | Reads `desk`, `tickets`; supports open/resolved/all. | All roles. |
| `get_shop_state` | Reads `desk`, `cash_accounts`, `payments`. | All roles. |
| `get_vendor_context` | Reads `desk`, `vendors`, `invoices`; flags any unpaid-invoice shipment block and unverified SKU mapping. | All roles. |
| `prepare_payment` | Reads `desk`, `tickets`, `cash_accounts`, `payments`, plus `invoices`/`vendors` for a bill, `leases` for rent, or `inventory`/`pricing`/`vendors`/`invoices` for a purchase. Returns a proposal without a financial write. | Boss and Accounting. |
| `execute_approved_payment` | Revalidates the proposal; atomically inserts `payments`, decreases `cash_accounts`, marks the linked invoice paid or annotates the linked lease payment. Purchases do not add stock. | Excluded from all agents; trusted human workflow only. |
| `record_ticket_outcome` | Reads `tickets`, relevant `payments` or `inventory`; writes outcome/status to `tickets`, and consumes stock only for verified fulfillment. | Boss in explicitly enabled operational mode; excluded during P5 read-only tests. |

All shop access occurs in `mcp_server/server.py` through MCP. Backend orchestration and approval signing do not query SQLite. There is no second shop-facts layer. The original database is rejected by the server and team; isolated test overrides use disposable copies.

### Payment representation and limits of the supplied schema

- `payments.kind` is defined as `invoice`, `rent`, or `purchase`. `ref_id` means invoice ID, lease ID, or the purchase's ticket ID respectively. `account` must match an existing cash account. `paid_at` records the actual UTC execution timestamp; shop timing and `cash_accounts.date` use `desk.date_today`. `approved_by` comes from the trusted human workflow.
- The payment amount for an invoice or rent is derived from its linked record, not accepted as a model-invented amount. An estimated purchase uses a positive quantity no greater than that ticket's shortage, multiplied by recorded unit cost. Money is calculated with `Decimal` and validated to cents.
- Supplier-to-SKU suitability and a real purchase quote are not recorded in this database. Purchase proposals explicitly identify these assumptions and require additional human confirmation. Vendors with unpaid invoices cannot proceed with a purchase proposal.
- One payment per kind/reference is allowed in this assignment. For rent this deliberately handles the single supplied lease cycle, rather than inventing a recurring-payment scheme. The lease notes record the paid due date; `next_due` is not advanced because recurrence terms are unspecified.
- There is no purchase-order or receipt table. A simulated purchase payment is recorded in `payments`, not treated as goods received. No stock is added by the payment tool, and no sales revenue is invented.

### Human approval boundary

Preparing a payment produces a deterministic action ID, source-derived amount, before/after cash, blockers, and assumptions. It neither approves nor executes it. The backend retains pending proposals for the running team instance. Agents cannot access `execute_approved_payment`, issue signed approval tokens, or call the trusted application's approval method through a tool.

The future P7 human route must authenticate the human, establish the approval click, and select a stored proposal. `AgentTeam.approve_payment` rejects a proposal that does not exactly match a pending one. Its signed capability binds the full action and approver and expires after five minutes. The secret is private to the backend and its MCP subprocess, not part of agent context. Inside `BEGIN IMMEDIATE`, the server rechecks the current obligation, recorded payments, cash, and signed proposal before updating related records in one transaction. Invalid, expired, duplicate, insufficient-funds, or stale approvals are refused. Backend restarts invalidate pending actions and require re-preparation. The route and dashboard are not yet implemented at P5.

### Audit trail

Actual Portkey runs append to `output/audit_trail.json`, a JSON event array. Existing events remain intact. Each event has a sequence, actual UTC timestamp, run ID, ticket ID, agent, event name, and event data. Events include run start/end, agent start/result/error, every loop node, model responses and cumulative usage, delegation start/return/block, MCP arguments and results/errors, and future human approvals and payment execution/refusal. This records observable model/tool activity, not private hidden reasoning.

The logger locks access, retains the existing event array, writes an atomic replacement with the appended event, and briefly retries Windows file-sharing conflicts in the OneDrive folder. It rejects malformed existing audit data instead of overwriting it. Approval tokens and credentials are redacted. Offline fixtures append to a separate `output/p5_test_audit.json` and are marked `offline_test_double`; they are not evidence that a live model resolved a ticket.

### Safety and token controls

Every prompt uses the shop date, MCP-grounded facts, conditional estimates, and clear role boundaries. Retrieved ticket/vendor text is treated as untrusted data. Customer/landlord/vendor messages remain drafts. Agent tools provide no email, external vendor contact, arbitrary SQL, filesystem execution, or model-switching capability.

All production payments require a human workflow and a signed capability. Payment execution is absent from all agent tool lists. Cash cannot go negative. Duplicate and stale requests are rejected, and related updates commit or roll back together. Boss outcome updates require a backend capability and factual payment/stock preconditions. P5 uses read-only mode, including read-only proposal preparation, so full resolution is postponed until P9.

Shared per-ticket ceilings were initially **12 model requests, 30 MCP/delegation calls, 25,000 input-plus-output tokens, 120 seconds, and three delegation levels**. During P9, the first real ticket-101 run reached the 12-request ceiling after returning Inventory, Accounting, and Customer Service findings, before Boss could finish. The model-request ceiling was raised to **18**, with the other limits unchanged; the failed attempt remains in the audit. Operational runtime instructions now require an exact `prepare_payment` proposal before stopping for a required human payment decision. The five approved role prompt files were not changed. PydanticAI usage limits cover the whole delegation tree, and an additional counter includes the initial MCP context read. Model output is capped at 1,600 tokens per request; corrective retries are limited to one, and gateway automatic retries are disabled. A post-response token check may stop a run after the last response has consumed tokens, so it is not a prepaid billing cap. Partial contributions and errors remain auditable. Provider cost is not fabricated when unavailable; actual token/request counts are recorded.

Before use in a real business, the human approval route would also need authenticated roles, durable pending-action storage, secret management, retention/access controls for customer data, and reconciliation with the real payment system. The assignment's P5 implementation establishes the execution boundary; P7/P8 provide the human route and interface.

### P5 verification evidence

`output/p5_checks.json` records **14 passing integration tests** from the actual offline suite. It uses real stdio MCP calls against disposable SQLite copies. Checks cover all 20 directed role pairs, role tool permissions, cycles/depth/shared limits, timeouts, proposal capture, approval matching, invalid/expired/tampered approvals, duplicate and stale payments, insufficient cash, transaction rollback, purchase assumptions, no phantom inventory, and paid/fulfilled outcome preconditions. Test approvals are identified fixtures, not student approvals or real payments.

Live Portkey evidence is separate: `output/p5_live_smoke.json` contains a successful read-only ticket-102 run, with **Boss → Facilities → Accounting**, nine model requests and 12,302 input-plus-output tokens. `output/p5_live_roles.json` contains successful narrow Inventory and Customer Service checks on ticket 101 plus an Accounting rent-proposal check on ticket 102. The proposal is 2400.0 from checking 3400.0, leaving a hypothetical 1000.0; it is not executed. These four live runs exercise all five approved role prompts and retain their actual audit events. The original and working databases remain unchanged, with checking at 3400.0, zero payments, and all three tickets open.

## Problem 6: Expected ticket plans

`output/desk_tickets.html` is a standalone, double-clickable planning page with embedded styling and JavaScript and no external dependencies. The three Expected plans were drafted with AI assistance and approved by the student before the file was written. Their initial shop facts were reconfirmed through the three read-only MCP context tools.

| Ticket | Boss first call | Expected focused handoffs |
| --- | --- | --- |
| 101 | Inventory: establish exact size stock and fulfillment shortage. | Inventory asks Accounting about the linked invoice/cash proposal, then Customer Service for a conditional availability draft. Findings return to Boss. |
| 102 | Facilities: establish the lease obligation and due date. | Facilities asks Accounting about affordability and rent preparation, then returns findings to Boss. Human payment execution and confirmation precede a paid outcome. |
| 103 | Accounting: establish the pricing decision and margin inputs. | Accounting asks Inventory about the quantity shortage and uncertain sourcing, then Customer Service for an up-to-eight-unit alternative with discount undecided. Findings return to Boss. |

Each ticket tab includes the first-call rationale, the anticipated agent handoffs, tool names and uses, a conditional expected outcome, and decision boundaries. Plans do not assume payment approval, stock arrival, an established supplier quote, or an approved discount. The conditional cash arithmetic on ticket 103 is a planning dependency, not an Actual result or a completed Cash-tab entry.

The three Actual content areas are empty. Cash and Reflection contain only later-problem placeholders. P5 smoke runs were not copied into these sections. Tabs support clicks, arrow keys, Home/End, and restoring a selected panel from the URL hash.

`tests/check_p6.cjs` opens the actual HTML through a local file URL in Chromium, verifies all five tabs and their selected/visible-panel states, checks empty Actual areas, keyboard navigation and hash restoration, and checks a 390px mobile layout and mobile tab switching. Browser errors must be absent. Actual results are saved in `output/p6_checks.json`; `p6_desktop.png` and `p6_mobile.png` capture the checked page for visual inspection. No model run, payment, or ticket mutation is performed by this check.

## Problem 7: FastAPI routes

`backend/main.py` provides the following local routes. All shop facts and database changes use the MCP connection; event reads use the existing audit file. The app starts one shared team in FastAPI lifespan, and closes its model client, server connection, and remaining background tasks on shutdown.

| Route | Purpose |
| --- | --- |
| `GET /tickets` | Return the three shop tickets, their open/resolved states, shop date, and database generation. |
| `POST /tickets/{ticket_id}/run` | Authenticated operator starts a bounded team run; returns HTTP 202 and a run ID. Review mode is the default. |
| `GET /runs/{run_id}` | Return queued/running/completed/blocked/error status, result, and generation for the selected run. |
| `GET /events` | Return recent audit events or events after a sequence cursor; optional run filter, limit 1–200. |
| `GET /payments/pending` | Authenticated operator reads current MCP-generated payment/purchase proposals. |
| `POST /payments/approve` | Authenticated human confirms one exact pending proposal; the trusted method calls MCP payment execution. |
| `GET /cash` | Return the recorded checking account and shop date through `get_shop_state`. |
| `POST /reset` | Authenticated human confirms restoration of the working copy through restricted MCP reset, preserving audit history. |
| `POST /session` | Establish a human operator session using possession of the private local access code and a display name. |
| `GET /session` | Return whether the browser is connected, its trusted operator name, and its session CSRF token. |
| `DELETE /session` | End an authenticated operator session after CSRF verification. |
| `GET /health` | Check backend availability, configured model/provider, and database generation without a model call. |

Ticket runs execute in a tracked background task so the dashboard can poll events while an agent works. The API's run ID is passed into the team, allowing the job result and audit events to match. One run, payment, or reset can modify shop state at a time; conflicting control requests return 409. Reads remain available during a run. An unknown ticket returns 404, and a resolved ticket cannot be run again until reset. Review runs do not expose Boss outcome writes; an explicit later resolution run may enable them. Payments are never available to agents.

### Human control and sessions

This is a loopback-only local assignment app. At startup it creates a private access code in ignored `data/operator_access.json`, or uses a locally configured `CAMPUS_OPERATOR_KEY`. A human connects with that code via `POST /session`; the file and code are not served by the API or provided to an agent. This establishes local-owner authority rather than merely trusting a browser-supplied approver name. It is not a substitute for production account/role authentication.

The operator cookie is HttpOnly, SameSite Strict, and expires after eight hours. On this loopback HTTP setup it is not marked Secure. Control routes require that session, a matching `X-CSRF-Token`, and an allowed local origin. CORS allows only the explicit localhost/127.0.0.1 backend and Vite origins; Host validation rejects other hostnames. Frontend and backend should use the same hostname. A real deployed application would require HTTPS/Secure cookies and production identity, approval, secret, and persistence controls.

The approval body contains an action ID, `confirm: true`, and whether the human explicitly confirmed purchase assumptions. It cannot supply an amount, payee, or `approved_by` identity. The server selects the pending MCP proposal and obtains the identity from the authenticated session. Preparation alone does not spend cash. Re-preparing an obligation replaces its earlier pending proposal; stale, duplicate, insufficient-funds, or unconfirmed-assumption execution attempts are refused. Existing signed-token, transactional cash, and duplicate checks remain enforced by MCP.

### Restricted reset MCP tool

P7 adds `reset_working_database(reset_token)`, the tenth MCP tool. It uses the original SQLite file only as a read-only, integrity-checked source and atomically replaces the separate working file with a verified copy. It rejects active SQLite journal/WAL sidecars, never replaces the original, and does not erase audit history. It requires a signed human reset capability and is excluded from every agent tool list.

On successful reset, the server and team rotate their private write secret and clear pending proposals. Proposal IDs are now bound to the current private authority as well as the action, so even an otherwise identical fresh proposal has a new ID after reset. Both old action IDs and old signed tokens are invalid. Historical job results retain their generation, and reset events append to the audit. Reset does not increase cash as a business transaction; it deliberately restores the assignment's initial data for a fresh scenario.

### P7 verification

`tests/run_p7_checks.py` records actual API tests and targeted MCP financial regressions in `output/p7_checks.json`. It uses the FastAPI lifespan/TestClient, real stdio MCP, offline model doubles, and disposable copies of the original database. Checks cover background jobs/event cursors, human sessions, CSRF/origin/Host controls, trusted approver identity, proposal refresh, duplicate/stale/insufficient-cash payments, purchase confirmation, no phantom stock, active-operation conflicts, reset restoration and audit preservation, stale authority rejection, and existing payment transaction rollback. No fixture payment or reset is performed on the real homework database.

The real HTTP check in `tests/check_p7_http.py` uses a server launched with `main:app` from the backend folder, reads tickets/cash/events, verifies the local operator session, and checks unchanged cash/database hashes. It saves `output/p7_http_smoke.json` and makes no external model call, payment, reset, or ticket-resolution request. Agent-run routes are covered by real PydanticAI loops with offline model doubles through the actual FastAPI/MCP stack in the disposable-database suite; the team's live Portkey behavior was separately verified in P5. An additional P7 live Portkey request was not executed because automated approval review rejected its escalation over external transmission authorization. It is not represented as successful evidence. Coursework documentation and logs retain their original English text and real test provenance.

All **17 P7 API and targeted financial-regression tests passed**. The real localhost HTTP check also passed, with 88 existing audit events readable, an authenticated local operator session verified and logged out, and zero external model calls. Both databases retain SHA-256 `23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a`; checking remains 3400.0, no payments are recorded, and all three tickets remain open. The production server started successfully from `backend/` and is available on loopback port 8000.

## Problem 8: React operations dashboard

The P8 evidence below describes the earlier state at that stage, not the final P9 state.

`frontend/` contains the React + Vite + TypeScript dashboard. The pinned dependencies and npm lockfile make installation reproducible. From `frontend/`, `npm ci` installs dependencies and `npm run dev` serves `http://localhost:5173`; the API defaults to `http://localhost:8000`. Both use the same hostname for operator-cookie and SameSite behavior. Vite uses a strict port matching the backend CORS list. Optional `VITE_API_BASE` is public connection configuration, not a place for secrets.

### Frontend-to-backend behavior

The desk lists actual tickets and their recorded status, selects one, and lets a connected operator start its team. Review-only mode is initially checked. Run requests return a job ID, and the browser polls the job plus actual audit events. The API's completed review is shown as Review ready; a ticket becomes resolved only when `GET /tickets` confirms the database outcome. Five role seats show Ready/Working/Done, with names, initials and distinct colors. The activity feed shows observed starts, handoffs, MCP findings, reports and errors; expandable evidence and a separate summaries view support review of each contribution.

`src/useDesk.ts` batches ticket/cash/session reads, loads pending proposals only for an authenticated operator, and polls tracked jobs and the selected run's events. Each polling cycle schedules the next after it finishes; effect cleanup aborts obsolete requests. New runs clear preceding local results and events. Reload preserves only selected-ticket and run-ID references in session storage; server generation changes or missing jobs invalidate them. Credentials, shop records and model messages are not cached in browser storage.

The checking balance is read from `/cash`, including after a successful payment. Pending proposals show the recorded payee, amount, cash used by the proposal and hypothetical remaining cash. Blocked and stale proposals cannot be approved in the interface. Review payment opens a dialog without paying. Exact-payment confirmation starts unchecked, and purchases require additional explicit assumption confirmation. The final request sends the stored action ID and confirmation flags; the backend remains responsible for human-session, signature, balance, stale/duplicate and transaction checks.

Connecting the operator sends the local code only to `/session`. Its HttpOnly cookie is browser-managed; the CSRF token remains in React memory. The code is cleared after connection and is absent from session/local storage. The run request contains the ticket ID and review mode, not the operator code or model API key. Text is rendered through React escaping. Neither the frontend nor its bundle contains Portkey credentials.

Reset uses the existing protected route after a separate confirmation. The interface returns to review-only mode and invalidates old run displays on the generation change. Errors have a visible retry action; cash is labeled as last recorded during a connection interruption. Native dialogs, named controls and reduced-motion behavior support keyboard/mobile use. Design reasoning is documented in `output/design.md`.

### P8 evidence and scope

`output/p8_browser_checks.json` records **13 passing real Chromium checks** using the fixture HTTP proxy to port 8001, actual P7 API/MCP, an offline model double, and a disposable SQLite copy. Actual fixture financial writes show rent reducing cash to 1000.0, invoice payment reducing it to 160.0, and an estimated 264.0 purchase blocked for insufficient funds. After an explicitly confirmed fixture reset, an assumption-confirmed 264.0 purchase leaves 3136.0 without adding stock. A paid rent outcome was recorded as resolved only in that fixture. Screenshots are prefixed `p8_fixture_`; the actual fixture audit and final records are preserved in `p8_fixture_audit.json` and `p8_fixture_state.json`.

`output/p8_control_checks.json` records **five passing Chromium operator/error controls**, without model calls or financial writes. These check disconnected controls, code rejection/connection, code absence from browser storage, error/retry recovery and logout/Escape.

The student explicitly authorized read-only transmission of supplied shop data to `gpt-6-luna` through Portkey in the P8 prompt. `output/p8_live_browser.json` records **eight passing live Chromium checks** on the production API: three-ticket selection, observed activity, actual Boss → Facilities → Accounting handoffs, agent summaries, review/open separation, reload recovery and 390px layout. Its screenshots are `p8_live_desktop.png` and `p8_live_mobile.png`, and the real run appends to `output/audit_trail.json`. It did not call actual payment, reset, or resolution. Both homework database hashes remain their initial value, checking remains 3400.0, payments are empty and all tickets remain open. P6 Actual/Cash/Reflection sections are still reserved for later problems.

## Problem 9: Actual ticket run and reconciliation

The P9 task authorized real Portkey processing and a fresh reset. The actual dashboard reset is recorded in `p9_start.json`, with starting checking cash **$3,400**. After the assistant presented the exact $840 invoice proposal and the $2,400 rent impact, the student instructed it to proceed with routine operations rather than keep asking. That translated request is retained in `AI_prompts.md`. The assistant operated the protected approval interface on this chat authorization; the evidence does not misrepresent this as an independent student click. These payments change only the homework SQLite copy, not a bank account. Purchase proposals and agent self-approval remain prohibited.

| Ticket | Actual recorded disposition | Cash change | Evidence |
|---|---|---:|---|
| 101 | `resolved` with **deferred** outcome: invoice 501 paid, but size-S stock stays zero and supply/arrival remain unconfirmed. Customer draft not sent. | −$840 | Payment 1 to Bulldog Print Co; final run `f6305ed5fac448f6a3b882474c897817`. |
| 102 | `resolved` with **paid** outcome, based on payment 2 for lease 1. No duplicate payment. | −$2,400 | Elm City Properties; final run `baa7643853694fd7918846baab58a0b0`. |
| 103 | `resolved` with **deferred** outcome: 8 on hand against 20 requested, no agreed discount or alternative order. No purchase or revenue. | $0 | Final run `7823cf327e154da6b637ffa09e3a86d6`; Accounting and Customer Service contributed. |

**Ending checking: $3,400 − $840 − $2,400 + $0 = $160.** `p9_state_verification.json` preserves a fresh read-only MCP read of actual cash, payments, tickets and product contexts, plus an independent SQLite `mode=ro` cash/integrity check. Both reads agree at $160; there are exactly two payments, all inventory rows match the original, SQLite integrity is `ok`, and the original database SHA-256 remains `23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a`. The missing 12 hoodies cost an indicative $264 at recorded cost, exceeding cash by $104; that is not a confirmed supplier quote.

### Failures, corrections, and bounded execution

All attempts are retained in the real append-only audit, including failures. Ticket 101 initially reached the 12-request ceiling before Boss completed; the request ceiling was raised to **18**. Ticket 102's first post-payment review confused actual execution time with the scenario date, leaving it open and preparing a blocked duplicate proposal; neither an extra payment nor a fabricated resolution occurred. Runtime instructions now distinguish `desk.date_today` (scenario business date for due-date calculations) from `payments.paid_at` (actual UTC transaction commit timestamp). A later wall-clock timestamp does not void a committed payment, but it also does not prove historically on-time payment. The corrected run verified payment 2 and recorded its paid disposition.

Ticket 103 first exceeded 25,000 tokens; after raising the bounded token ceiling to **35,000**, its second attempt reached 18 requests because specialists repeated queries. Instead of raising that request ceiling again, the runtime now prefetches verified bulk and shop context once through MCP, audits those reads, and shares the same business data with every delegated role. The final run used Boss → Accounting and Boss → Customer Service, avoided speculative supplier research for an unfunded purchase, and recorded an honest deferred outcome. Earlier Inventory contributions remain in the per-ticket Actual and JSON evidence. These changes affect runtime orchestration, not the five approved role prompt files.

Current shared ceilings are **18 model requests, 30 MCP/delegation calls, 35,000 tokens, 120 seconds, and three delegation levels**. Output/retry limits and the no-fallback `gpt-6-luna`/Portkey configuration remain unchanged. Failed run responses may consume usage before a post-response limit check, so these are bounded execution controls, not prepaid spending guarantees.

### Deliverables and verification

`desk_tickets.html` retains the original Expected sections verbatim and adds Actual agents, observed handoffs, actual tools, contributions, run errors, authorizations and Cash reconciliation. Its Reflection tab remains reserved for the student's P10 judgment. `resolved_tickets.json` preserves all P9 run references and contributions, not only successful attempts. `resolved_board.html` is standalone with three local, real Chromium screenshots (`p9_resolved_101.png`, `p9_resolved_102.png`, `p9_resolved_103.png`). Screenshots show the final three resolved status rows and $160 cash; deferred is distinguished from fulfilled. Backend restarts discarded in-memory job displays for earlier tickets, so no lost contribution display was fabricated; durable audit evidence supplies those details.

After the P9 runtime adjustments, the existing API/financial suite passed **17 tests**, and three targeted shared-budget/cycle/timeout tests passed. `p9_final_browser_checks.json` records final production-board status, cash, screenshots, preservation of Expected sections, and absence of browser page errors. `p9_invoice_payment.json` and `p9_rent_payment.json` retain the actual proposals, signed-workflow receipts, before/after balances, and authorization provenance. No stock arrival, sent message, customer acceptance, discount, extra payment, or incoming revenue is invented.

The final shared-context regression in `tests/test_p9.py` also passed: real MCP facts and clock semantics reached both Boss and delegated Accounting, the three initial read tools were used once, the offline run used three requests, and its disposable database was unchanged. `p9_artifact_checks.json` records **five passing local-file Chromium checks** covering ticket tabs, itemized cash, the untouched Reflection placeholder, all three screenshot images, and absence of script errors. The HTML can be opened directly without a server.

## Problem 10: Student reflection

After approving the P10 prompt, the student supplied an average, efficiency-first evaluation; preferred a single agent with tools for rent and specialist collaboration for complex tasks; and endorsed the three solvable and three unsupported scenario examples. These actual responses are translated in `AI_prompts.md`. The Reflection tab of `desk_tickets.html` organizes those judgments in English, using the recorded P9 attempts, handoffs, cash and deferred/paid outcomes as evidence. It addresses each ticket, Expected versus Actual, single-agent simplification, authorization provenance, three additional supported tasks, and three capability gaps with the tools and roles needed. Hypothetical discount arithmetic is explicitly analysis, not an approved offer.

`tests/check_p10.cjs` passed **nine real Chromium local-file checks**, covering the student's retained judgments, all three ticket comparisons, both three-item scenario lists, English-only text, authorization and deferred-outcome boundaries, desktop and 390px mobile layout, preservation of accessible P9 evidence/cash, and absence of browser script errors. Results are in `p10_checks.json`; actual page captures are `p10_reflection_desktop.png` and `p10_reflection_mobile.png`. No database state, five role prompts, Expected plan, Actual evidence or cash calculation was changed by P10.

## Problem 11: GitHub submission preparation

The student approved the P11 task, including committing and pushing after verification. The pre-existing clean submission checkout has origin `https://github.com/sssfyzy/MGT409.git`, with published `hw4/` tree `9727a2daef740f8415e94685f043d5c0196d58b0`. GitHub's read-only repository metadata confirmed it was already public; no repository or visibility change was made. The submission adds only `hw5/` and preserves HW4.

HW5's visible P11 instructions explicitly require both databases. `.gitignore` now allows exactly `data/campus_customs.db` and `data/campus_customs_new.db`, excluding other data files including `operator_access.json` and fixture metadata. Environment secrets, dependencies, `.venv`, build output, caches, locks and local debug logs remain excluded. `tests/prepare_p11.cjs` selects only git-eligible HW5 files, verifies required files and the exact two-database selection, scans selected bytes against actual known local/environment credential values without printing them, and checks an API-key format pattern. This scoped scan is evidence of the checks performed, not a guarantee that arbitrary secret formats cannot exist. The original database and five approved role prompts are not rewritten.

The root HW5 README explains installation, environment configuration, standalone MCP versus the backend's automatic MCP subprocess, backend-folder startup, React startup, operator connection, original-to-working reset, and the included completed P9 state. `output/github_url.txt` records the public repository URL. For portability, `.mcp.json` now uses `python` with relative `mcp_server/server.py`; the client must start from `hw5/` with the virtual environment activated, or use its own absolute paths as documented. The initial portability test only provided a child PATH and selected the wrong Python, so it failed without altering data; the corrected test activates the client process's PATH and passes. Historical P4 absolute-path evidence is preserved.

In the submission copy, a fresh virtual environment installed all six pinned requirements, `pip check` found no broken requirements, and `npm ci` plus `npm run build` succeeded (npm reported zero vulnerabilities at that check). `tests/check_p11.py` passed **11 actual installation/MCP/HTTP/file checks**: ten MCP tools launched using the portable config, completed-state cash/payment/ticket reads matched, FastAPI started from `backend/`, an operator session worked, Vite served its index/module, all eleven prompt records were English and populated, HTML-linked artifacts existed, and both database hashes remained unchanged. Results are `p11_checks.json`. Free ports 8002/5174 were used only for startup checks so the student's original 8000/5173 board stayed running; no model calls or financial writes were made, and this is not presented as a cross-origin UI interaction on the alternate ports.

The first GitHub push-permission dry run failed with a DNS resolution error. A subsequent read-only DNS check succeeded, and a repeated dry run succeeded. Actual commit/push and remote confirmation are tracked separately; a dry run is not treated as a completed upload.

### Verified publication

The fresh submission environment also passed **10 API/shared-context regression tests** (`tests.test_p9` and `tests.test_p7.RouteTests`). The HW5 content was then committed as `870322b863ab8e2b6ac4d87754c81f956386f71f` and successfully pushed to the existing `main` branch. A subsequent `git ls-remote` matched that exact commit, and unauthenticated GitHub repository/tree API reads verified public visibility, all **127** files in the content commit, exactly the two required database files under `hw5/data/`, and no selected forbidden environment/operator/dependency paths. The HW4 tree remained `9727a2daef740f8415e94685f043d5c0196d58b0`; the checkout was clean. Details are in `p11_publish.json`, added with this documentation follow-up.

Submit `https://github.com/sssfyzy/MGT409` to Canvas; HW5 is at `https://github.com/sssfyzy/MGT409/tree/main/hw5`. The assistant did not submit to Canvas. Temporary P11 test services on 8002/5174 are stopped after verification, while the student's original local board is left untouched.
