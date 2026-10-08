# Campus Customs dashboard design — Problem 8

## Direction

I chose a calm operations desk with a FinCanvas-inspired visual language: a pale canvas, white bordered cards, restrained violet accents, generous spacing, and clearly prioritized numbers. The student delegated the specific layout and visual decisions to the assistant. This is an original dashboard design for the supplied operations workflow.

The main message is “A clear view. A capable team.” The interface gives the human a quick overview and a place to supervise actual agent work. The left navigation, three overview cards, and ticket workspace form one consistent system. All five agents have visible seats, even when only a subset contributes to a particular ticket.

## Layout and hierarchy

At desktop width, the workspace has three columns: a ticket inbox, the selected ticket and its team activity, and a human-decision panel. The first task is choosing a ticket, the second is understanding the team's findings, and the third is approving a specific action if appropriate. Cash, open-ticket count, and pending-decision count sit above the workspace so the current business state is easy to check.

The inbox cards show the ID, subject, requester, category, and recorded status. Selecting one uses a violet border and a lightly tinted surface. The detail card uses the supplied ticket notes and SKU/size/quantity or lease reference. These are backend facts, rather than a hard-coded scenario story.

On smaller laptops the decision panel moves below the work column. On mobile the side navigation becomes a compact header and all workspace sections stack in reading order. At 390px width the ticket cards stack vertically, the run control becomes full width, and the cash overview remains near the top. Real Chromium checks confirmed no page-level horizontal overflow.

## Typography and color

The font stack uses Inter when locally available, followed by platform system fonts. No remote font is required. Large, tabular currency figures make balance changes easy to read. Headlines and ticket names carry the strongest weight; timestamps and category labels remain subordinate. Compact supporting labels keep the desk readable without competing with the decisions.

Violet identifies selection and primary actions. Amber labels open work or financial blockers. Green identifies a recorded resolved outcome or successful action. Agent color is accompanied by its name and initials, so color is not the sole way to identify a role:

| Agent | Visual identity | Work emphasis |
| --- | --- | --- |
| Boss | Violet / B | Direction and final decisions |
| Inventory | Blue / I | Stock and sourcing |
| Accounting | Green / A | Cash and margins |
| Facilities | Amber / F | Space and obligations |
| Customer Service | Rose / CS | Clear customer drafts |

## Creative choices

The five “team seats” give the multi-agent workflow a physical-desk feel. Their labels change from Ready to Working to Done based on actual events and reports. This creates a sense of a team participating in the selected ticket while remaining grounded in recorded behavior.

The decision panel says “The team prepares. You approve.” A small desk note says “Your team investigates. You decide when money moves.” These phrases explain the human role at the point where it matters. The “Drafts, not deliveries” note clarifies that a message draft or purchase proposal does not prove a customer was contacted or goods arrived.

The activity feed translates recorded operations into readable entries: who started, who asked another specialist for help, what record was checked, and what conclusion returned. Verified evidence can be expanded when the human wants to inspect the source. Agent summaries provide an alternative view for reviewing each contribution without following every step.

## Status and approval experience

A completed review is labeled Review ready. It stays open in the ticket queue until the backend records a resolved outcome. The board does not infer resolution from a finished model response.

A payment proposal shows its payee, exact amount, cash before payment, and hypothetical cash afterward. The first button opens a review dialog. An unchecked exact-payment checkbox and explicit confirmation button establish the human decision. Estimated purchases have an additional unchecked assumptions confirmation. A cash change makes an earlier proposal visibly stale; insufficient cash produces a warning and disables payment review. These controls were tested with actual API/MCP writes on a disposable database.

Reset has its own confirmation and explains that the original scenario returns while audit history remains. Operator connection uses the private local code from the backend; the code is cleared after submission and is not stored in the browser. Browsing remains available before connection.

## Motion, errors and accessibility

Short color and border transitions provide feedback. Reduced-motion preferences disable transitions and smooth scrolling. Live activity uses recorded events and clearly named role states, rather than decorative simulated typing or invented progress percentages.

Buttons, checkboxes, native modal dialogs, visible focus outlines and explicit labels support keyboard use. Escape closes a dialog when an action is not being processed. Errors appear in readable alerts with Retry / refresh. If the connection fails, cash is labeled as the last recorded value until refresh succeeds.

## What was actually verified

- TypeScript checking and the production build succeeded.
- The fixture Chromium suite passed 13 checks through the actual React interface, P7 API and MCP server. It exercised ticket selection, live activity, handoffs, agent summaries, explicit payment confirmation, cash changes, recorded resolution, insufficient-cash refusal, reset, purchase assumptions, reload recovery and mobile layout.
- A further five Chromium checks verified disconnected controls, invalid/valid operator codes, absence of the code from browser storage, connection-error recovery, logout and Escape behavior. They performed no model calls or financial mutations.
- The student-authorized live Chromium run on ticket 102 passed eight checks using the production backend and `gpt-6-luna` through Portkey. It displayed actual Boss → Facilities → Accounting handoffs and contribution summaries. Cash stayed at 3400.0, all tickets remained open, and both homework database hashes were unchanged.

Fixture screenshots and audit/state evidence are explicitly labeled as isolated tests. Live screenshots and results are separate. The payment/resolution screenshots do not claim the real homework tickets were resolved during P8.
