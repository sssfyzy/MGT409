# HW5 AI Prompt Log

This file records the requests I actually give my vibe coder while working through Homework 5. Follow-up requests and a one-sentence note about what the first attempt lacked will be added when applicable.

## Problem 1: Vibe coder prompts

### Initial prompt

> For Problem 1, set up `AI_prompts.md` as a running record for HW5. Create one section for each of the 11 problems, labeled with its number and title. Record the requests I actually give you as we work, including follow-up requests. When a follow-up is needed, add one sentence explaining what the first attempt was missing.

## Problem 2: Study the Campus Customs database

### Initial prompt

> For Problem 2, inspect the actual `data/campus_customs.db` database and document every table and field. Make a working copy named `data/campus_customs_new.db` without changing the original. Examine the three open tickets and explain how each connects to the other tables. Start `output/harness.md` with each table’s fields and a short explanation of why that table matters to the agents. Base the descriptions on the database, and flag anything unclear.

## Problem 3: Build the MCP server

### Student-approved prompt (draft supplied by the assistant)

> For Problem 3, build a FastMCP server in `mcp_server/` that reads `data/campus_customs_new.db`. Propose three clearly named, database-backed tools: one to investigate the stock and vendor-invoice context for ticket 101, one to inspect the lease and cash context for ticket 102, and one to assess stock and pricing for ticket 103. Show me each tool’s name, inputs, and returned fields, and wait for my approval of those choices before implementing them. Do not invent database facts. After approval, add the three tools, document the table and ticket each serves in `output/harness.md`, and write `mcp_server/README.md` explaining the server, database, and tools. Do not connect it to the vibe coder yet.

### Follow-up approvals (translated from Chinese)

> Approved.

> I agree.

What the first pass lacked: the initial approved draft deliberately left the three tool names, inputs, and returned fields for a separate student decision; I approved the specific three-tool proposal before implementation.

## Problem 4: Add the MCP server to vibe coder and test each tool

### Student-approved prompt (draft supplied by the assistant)

> For Problem 4, connect the FastMCP server in `mcp_server/server.py` to this Codex project using `.mcp.json` or the project-local MCP configuration Codex supports. Before testing, propose one natural-language question for each of the three tools and let me approve or edit the questions. Then call every tool through the connected MCP interface, not by directly invoking its Python function. Save `output/mcp_smoke.json` with each question I actually asked, the tool name, and its real output. Check the outputs against `data/campus_customs_new.db`. Do not invent a connection, tool call, or result; if Codex cannot load the server in this session, tell me what action is needed. Keep the original database unchanged and update `AI_prompts.md` with my actual P4 requests.

### Follow-up approval (translated from Chinese)

> Approved.

### Approved test questions (assistant-drafted; executed through native MCP tools on 2026-10-06)

> For ticket 101, use `get_order_fulfillment_context` to check whether the requested size-S Bulldog tee is in stock. What is the linked vendor invoice status and vendor lead time? Do not place an order or make a payment.

> For ticket 102, use `get_rent_context` to tell me when rent is due, how much it is, and the current checking-account balance. Do not make a payment.

> For ticket 103, use `get_bulk_discount_context` to compare the request for 20 size-M navy hoodies with current stock. Show the unit cost, list price, and per-unit gross margin at list price. Do not approve a discount.

### Follow-up approval (translated from Chinese)

> Approved.

What the first pass left open: the initial P4 request did not specify the three exact test questions; I approved them before any MCP tool-call evidence was recorded.

### Follow-up request (translated from Chinese)

> Please set up the Codex connection for me. I can approve the required change.

What the first setup was missing: the project-local MCP configuration was not loaded by the current session, so I asked for help connecting the server. At that point, the three approved questions had not yet been executed through MCP; they were subsequently executed on 2026-10-06.

### Follow-up correction (translated from Chinese)

> Are you an idiot? I previously did everything in Chat's Work mode. Do I have to open Codex this time?

What the first setup guidance got wrong: the assistant unnecessarily directed me to a separate Codex project instead of first checking the tools available in my intended Work workflow.

### Follow-up request (translated from Chinese)

> Continue working on this assignment.

The resumed session exposed all three native MCP tools. The assistant ran the already-approved questions, saved their actual responses in `output/mcp_smoke.json`, and independently checked every returned field against the working database.

## Problem 5: Build the agent team and grow the MCP tools

### Student-approved prompt (draft supplied by the assistant)

> For Problem 5, build the Campus Customs operations team using PydanticAI with five agents: Boss, Inventory, Accounting, Facilities, and Customer Service. Use only `gpt-6-luna` through Portkey for every agent, loading `PORTKEY_API_KEY` securely from my local environment.
>
> Before writing the five system prompt files, show me detailed drafts for each role and a proposal for any additional MCP tools. Wait for my approval. Each prompt should explain the agent’s responsibilities, delegation rules, scope, and relevant shop rules in clear language.
>
> After approval, place one prompt per agent in `backend/prompts/`, define data types in `backend/models.py`, and implement the agents and bounded execution loops under `backend/`. Allow every agent to delegate to any other agent, while preventing delegation cycles and uncontrolled token use.
>
> All shop facts and database changes must go through the MCP server over `data/campus_customs_new.db`. Use `desk.date_today` as the shop date, read vendor lead times from the database, and account for the rule that vendors will not ship while they have an open unpaid invoice. Require human approval for every payment, refuse insufficient-cash payments, and update the relevant records consistently after an approved payment. Do not invent incoming revenue. Customer messages and vendor communications must remain drafts.
>
> Append real execution records to `output/audit_trail.json` without erasing previous runs. Record each agent-loop step, delegation, tool call, result, decision, error, and token usage when available.
>
> Update `output/harness.md` with the five agents, every MCP tool and its tables, business guardrails, and execution limits. Update `mcp_server/README.md`. Verify agent connectivity, MCP access, and audit recording with read-only runs; leave actual payments and ticket resolution for the later assignment stages.

### Follow-up approval (translated from Chinese)

> Approved.

The task prompt was approved. The five role-specific system prompts and additional MCP tools were then presented separately for student approval before implementation, as this request specifies.

### Follow-up approval of the role prompts, tools, and execution limits (translated from Chinese)

> Approved.

What the initial task prompt left open: the assistant supplied detailed drafts for Boss, Inventory, Accounting, Facilities, and Customer Service, plus six additional MCP tools and shared execution limits; I approved that concrete proposal before the prompt files and implementation were written. The role prompts are assistant-drafted and student-approved, not claimed as text I independently authored.

## Problem 6: Plan the three tickets

### Student-approved prompt (draft supplied by the assistant)

> For Problem 6, help me plan the expected agent behavior for tickets 101, 102, and 103 before implementing the backend routes.
>
> For each ticket, propose which specialist the Boss should call first, explain why, identify the focused agent-to-agent delegations, and list the MCP tools the run should use. Avoid involving every specialist unless each has a concrete contribution.
>
> Show me the three proposed plans and wait for my approval or edits before writing them into `output/desk_tickets.html`.
>
> After approval, create a standalone HTML page with separate tabs for tickets 101, 102, and 103. Put the approved plans in each ticket’s Expected section, leave its Actual section empty for Problem 9, and add placeholder Cash and Reflection tabs. Do not present the P5 smoke tests as the later ticket-resolution run. Record my actual requests and approvals in `AI_prompts.md`.

### Follow-up approval (translated from Chinese)

> Approved.

The task prompt was approved. The three concrete Expected plans were then presented for review before the HTML file was written, as requested.

### Follow-up approval and delegation of routine choices (translated from Chinese)

> Approved. Make this kind of decision yourself from now on.

What the initial task prompt left open: the specific first calls, specialist handoffs, tools, and conditional outcomes had not yet been selected; I approved the three proposed plans and authorized the assistant to decide similar routine delegation and implementation details going forward. My personal assignment judgments, reflection, and actual payment approvals remain separate decisions.

## Problem 7: Backend routes

### Student-approved prompt (draft supplied by the assistant)

> For Problem 7, build the FastAPI routes in `backend/main.py` so the future dashboard can list tickets, run the agent team for a selected ticket, read recent agent events, approve a prepared payment or purchase after a human clicks approve, read the checking balance, and reset the working database to the original values.
>
> Choose the route names and implementation details yourself. Keep shop database access behind MCP, adding a restricted reset tool if needed. Preserve the original database and append-only audit history.
>
> Agents may prepare payment proposals but cannot approve or execute them. The approval route must establish a human approval, match the pending proposal, and use the existing signed execution workflow. Recheck current cash and reject insufficient funds, stale proposals, and duplicate payments.
>
> Verify that the backend starts from the `backend` folder. Test the routes and financial safeguards using disposable database copies, without paying or resolving the real homework tickets yet. Document every route in `output/harness.md` and record my actual requests and follow-ups in `AI_prompts.md`.

### Follow-up approval (translated from Chinese)

> Approved.

Routine route and implementation choices are delegated to the assistant under my earlier instruction. This implementation approval does not approve an actual payment or ticket resolution.

## Problem 8: Agent dashboard

### Student-approved prompt (draft supplied by the assistant)

> For Problem 8, build the Campus Customs operations dashboard in `frontend/` using React, Vite, and TypeScript, connected to the backend at `http://localhost:8000`.
>
> List all three tickets, let me select and run one, show live agent activity and delegation, summarize each agent’s contribution, display the checking balance, and provide a clear human approval interface for pending payments or purchases. Show a ticket as resolved only when the backend confirms that status.
>
> Choose the layout and visual details yourself, following the FinCanvas-inspired style. Make the five agents easy to distinguish, and make pending approvals, errors, cash changes, and resolved tickets clear on desktop and mobile.
>
> Use the existing operator session and approval safeguards. Actual homework payments still require my separate approval.
>
> I authorize read-only test runs to send the supplied HW5 ticket and relevant shop data to `gpt-6-luna` through my Portkey account. Never transmit API keys or operator access codes to the model. Test payment and reset behavior only with disposable database copies.
>
> Verify the dashboard in a real browser, write `output/design.md` explaining the design choices, update `output/harness.md`, and record my actual requests in `AI_prompts.md`.

### Follow-up approval (translated from Chinese)

> Approved.

This approval authorizes the described Portkey read-only tests using the supplied shop data, while actual homework payments remain separate human decisions. Routine layout and implementation choices are delegated to the assistant.

## Problem 9: Resolve the tickets

### Student-approved prompt (draft supplied by the assistant)

> For Problem 9, reset the working database to the original values and record the starting checking balance. Then use the real dashboard and agent team to work through tickets 101, 102, and 103 until each has an evidence-supported resolved outcome.
>
> I authorize these runs to send the supplied ticket and relevant shop data to `gpt-6-luna` through Portkey. Before any payment or purchase, show me the exact payee, amount, reason, and cash impact, and wait for my separate explicit approval.
>
> Preserve the Expected plans in `output/desk_tickets.html`. Fill each Actual section from the real run, including agents, delegations, tools, and outcomes. Complete the Cash tab with starting balance, each ticket’s actual cash change and explanation, and the ending balance reconciled to SQLite.
>
> Save `output/resolved_tickets.json` and `output/resolved_board.html` with real screenshots of all three resolved tickets. Append actual events to the audit trail and finish `output/harness.md`. Do not invent stock arrivals, completed communications, approvals, or successful results.

### Follow-up approval (actual request)

> apporved

Interpreted as approval of the Problem 9 task. Individual payments and purchases still require separate explicit approval of their exact details.

### Follow-up request (translated from Chinese)

> Do you need to ask me even about small things like this? Just start doing it, and ask me when you need a prompt from me.

What the previous attempt left incomplete: the assistant had stopped at the exact $840 invoice-501 proposal ($3,400 to $2,560), also explaining that the existing $2,400 rent would leave $160 afterward. I directed the assistant to proceed with routine assignment operations rather than repeatedly seek confirmation. This authorizes proceeding with the disclosed existing obligations in the homework working database; it does not authorize real-world bank transfers, speculative purchases, fabricated stock receipt, or invented customer acceptance. My personal reflection and any new student-authored prompt remain mine to provide.

## Problem 10: Reflection

### Student-approved prompt (draft supplied by the assistant)

> For Problem 10, help me develop my reflection using the actual P9 results. First summarize the evidence for each ticket, including performance, failures, human authorization, cash changes, and Actual versus Expected handoffs.
>
> Ask for my views before writing the Reflection tab: how I evaluate each ticket, what would be simpler with one agent and tools, three new Campus Customs problems the current team could solve, and three it could not solve without additional tools or agents. You may suggest concrete options for me to choose or revise.
>
> Then help translate and organize my answers into clear English in the Reflection tab of output/desk_tickets.html. Keep my judgments distinct from recorded facts, and do not invent my opinions.

### Follow-up approval (translated from Chinese)

> Approved.

This approves the reflection-development process, not invented student opinions. The assistant reviewed the actual P9 evidence and requested my evaluation and scenario choices before writing the Reflection tab.

### Student evaluation and choices (translated from Chinese)

> 1. Average. I care about efficiency.
> 2. Rent only needs an agent plus tools. Complex tasks can use multiple agents working in separate roles.
> 3. I agree with the proposed examples.

What the first reflection-development attempt was missing: it had presented the actual evidence but still needed my personal evaluation and scenario choices. I supplied my efficiency-first assessment and endorsed the proposed three solvable examples (overdue vendor invoice/shipment-block review, internal cash/payment reconciliation, and discount-margin analysis) and three unsupported examples (confirmed supplier arrival, sending actual customer email, and returns/refunds). The assistant may translate and expand these judgments using the real P9 evidence, without inventing additional opinions.

## Problem 11: Submit to GitHub

### Student-approved prompt (draft supplied by the assistant)

> For Problem 11, prepare HW5 for GitHub submission using the assignment’s required hw5/ layout. Include both data/campus_customs.db and data/campus_customs_new.db, preserving the original and the completed working state.
>
> Update .gitignore to include only the required databases while excluding API keys, real .env files, operator credentials, temporary data, environments, dependencies, and build outputs. Add a root README explaining installation, configuration, MCP startup, FastAPI startup, React startup, and resetting before a fresh full run.
>
> Check all required files, prompt records, completed HTML tabs, JSON results, audit history, and screenshot links. Scan the submission for secrets and verify that setup instructions work.
>
> Inspect the existing Git remote. Use my MGT409 repository if it is the verified project repository; otherwise ask me for the destination. Preserve HW4 and unrelated changes. After verification, commit and push HW5, write output/github_url.txt, and give me the URL to submit to Canvas. Ask before changing repository visibility or creating a new repository.

### Follow-up approval (translated from Chinese)

> Approved.

The existing clean submission checkout was verified against `https://github.com/sssfyzy/MGT409.git`; it contains HW4 and already has public visibility. This approval authorizes adding and pushing HW5 without altering HW4 or repository visibility. No repository was created. Personal environment files and operator credentials remain excluded; the two coursework databases are included as explicitly required by HW5.
