# HolySplit

Live app: https://holysplit.yvetteh9b.chatgpt.site

HolySplit helps a small group plan an event and settle what people actually spent. The organizer signs in, creates an event, and shares an invitation link. Friends can join without accounts, choose heroes, edit the preparation board, claim items, and record their own payments. The app computes balances and suggested reimbursements in USD. It never moves money.

## Try the hosted app

1. Open the live app above in a current browser. The organizer signs in using the hosted site's sign-in flow.
2. Create an activity with a time, place, and expected headcount.
3. Generate the event invitation and share it privately. A friend opens it and explicitly taps **Join activity** before HolySplit creates a guest record.
4. In **Preparation**, add or import budget rows, claim items, and record actual costs. Use **Split** to see balances and suggested transfers.

Do not paste an invitation token into a public issue or screenshot. Anyone holding a valid invitation can join until the organizer revokes it or it expires. Guests use a browser-stored identity and may lose access after switching devices or clearing browser data.

The party-budget assistant uses an OpenAI model when the hosted runtime has `OPENAI_API_KEY` and `OPENAI_MODEL`; otherwise the UI labels its output as a rule-based starter list. Drafts are rough estimates; the organizer reviews selected rows before they change the board. The split uses actual amounts, not AI estimates. The separate English help agent uses read-only tools for workflow instructions and a signed-in member's own split. It cannot edit costs or verify payments.

The hosted Site currently has a personal `OPENAI_API_KEY` secret and `OPENAI_MODEL=gpt-5.4-mini` configured. The source preserves provider-reported input, cached-input, and output tokens for the budget draft and help agent. No successful hosted AI run and usage record has been documented for the course report yet; model configuration alone is not evidence of a completed run. A real-run trace and cost calculation are still required.

## Repository setup and checks

This is a Vinext/Cloudflare Worker app with D1 storage. Node.js 22.13 or newer is required.

```text
npm ci
npm run build
npm run dev
```

The hosted URL is the recommended grading path. A local fresh clone needs the Sites-compatible development runtime and local D1 migration, and its database is separate from production. The historical `npm run start:legacy` command starts the retired meal-planner prototype, not the shared HolySplit service. No real `.env` is committed; `.env.example` lists configuration names.

Current-app tests can be run with:

```text
npm run test:current
```

On October 25 the local build completed and the full `npm test` suite passed 161 of 161 tests. A regression test confirms that a payer can mark a preparation-board reimbursement as sent, that the pending suggestion disappears, and that a repeated confirmation is rejected. These are local checks; they do not verify a hosted AI run. The retired Belly & Budget report and milestone notes are historical evidence, not descriptions of the current app.

## Security and limitations

- The organizer is identified by the hosted sign-in user ID. Guests receive event-scoped browser credentials. Server routes check event membership and payer ownership.
- Inviting, joining, expense entry, and settlement have different authorization checks. The organizer can revoke a link or remove a guest.
- A valid invitation can be forwarded. The app does not verify real-world identity.
- The AI draft cannot confirm prices, bookings, or payments. Manual review and field validation occur before budget rows are stored.
- Zelle and other transfers happen outside HolySplit. The site cannot confirm their completion or the intended recipient.
- Outlook sending requires a separate Microsoft app registration and runtime configuration; it is not required for the core link-and-split flow.

## Course submission

Canvas requires the GitHub repository URL, `report.html`, and `slides.html`. The repository is https://github.com/sssfyzy/MGT409; this source belongs in its `Final Project` folder. A 2–3 minute demo video is optional. The repository may be public, or private with GitHub user `zlisto` added as a collaborator. the report and slides include real Barbecue screenshots, but still lack a verified hosted AI run, token-cost measurements, and measured impact. The hosted link must remain working until final grades are posted.

If uploading through GitHub's web interface, select source files deliberately. Do not drag the entire local directory: `.git/`, `node_modules/`, `.wrangler/`, `.env`, and local runtime data must stay off GitHub. Git command-line uploads respect `.gitignore`, but the browser file picker does not apply it automatically. The final folder should include this README, `.env.example`, the application source, tests, `report.html`, and `slides.html`.
