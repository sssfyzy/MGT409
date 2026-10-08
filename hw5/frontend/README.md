# Campus Customs operations desk — Problem 8

The React + Vite + TypeScript dashboard uses the P7 API at `http://localhost:8000`. It presents the ticket queue, recorded cash, five distinct agent roles, actual activity and contribution summaries, and pending human decisions.

## Run locally

Start the backend from `backend/` as documented there. From this `frontend/` folder:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. The Vite port is fixed so it matches the backend's allowed origin. Use `localhost` consistently for both frontend and API. Optional `.env` setting `VITE_API_BASE` changes the backend URL; no model API keys belong in frontend environment variables.

Connect an operator using the code in ignored `data/operator_access.json`. The connected session is a server-managed HttpOnly cookie. The access code is only held temporarily in the connection form and is cleared after submission; it is never placed in browser storage or a model request. Browsing tickets and cash works before connecting. Running the team, payment confirmation, and reset require the operator session.

Review-only mode is enabled initially. A completed review keeps its ticket open. For a later authorized resolution run, turn Review only off. The board changes a ticket to resolved only when the backend returns that recorded status. Payment approval is separate in either mode.

Pending proposals show their source-derived amount, payee, cash snapshot, and hypothetical cash after payment. Review payment opens a confirmation dialog without spending money. Exact-payment confirmation is unchecked initially; purchase assumptions require a separate explicit checkbox. Blocked or stale proposals cannot be approved through the UI. Reset also requires an explicit confirmation.

## Data refresh and build

The dashboard polls approximately every 1.4 seconds after the previous refresh finishes. It loads tickets, cash and the operator session together, then proposals, tracked run results, and actual audit events. Effect cleanup cancels old requests. A new run clears its preceding local display; generation changes invalidate cached run IDs. Browser session storage holds only ticket selection and run IDs. React escapes all ticket notes and agent text.

Run `npm run build` for strict TypeScript checking and a production Vite build. Generated `dist/` and `node_modules/` are ignored; `package-lock.json` is committed for reproducible installation.

## Browser checks

`tests/check_p8.cjs` uses real Chromium. Its default financial-flow check requires the isolated server started with `python -m tests.p8_fixture_backend` from the HW5 root. Browser API requests are explicitly proxied to the fixture on port 8001; offline model doubles use the real P7 API and MCP server against a disposable database. No real homework payments or resets occur. The fixture check restores its disposable scenario at the start so it can be repeated.

`tests/check_p8_controls.cjs` verifies operator connection/logout, error handling/recovery and dialog keyboard behavior on that fixture. `tests/collect_p8_fixture.py` preserves its actual audit and final state for verification before cleanup.

The explicitly student-authorized `tests/check_p8.cjs --live` mode uses the production server and `gpt-6-luna` through Portkey, with Review only checked. It reads the supplied ticket/shop facts and verifies actual activity; it never clicks real payment, reset, or resolution controls. Its screenshot/results are separate from fixture evidence. Do not treat an implementation approval as permission for an actual homework payment.
