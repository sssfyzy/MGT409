/* Compile P9 deliverables exclusively from real production run evidence.
 * Refuses to produce final artifacts unless all three database tickets are resolved. */
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'output')
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'))
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const write = (name, content) => fs.writeFileSync(path.join(out, name), content)
const list = items => '<ul>' + items.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
;(async () => {
  const start = read('p9_start.json')
  const audit = read('audit_trail.json')
  const runs = fs.readdirSync(out).filter(x => /^p9_ticket_\d+_[a-f0-9]+\.json$/.test(x)).map(read).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const payments = ['invoice', 'rent'].map(kind => read(`p9_${kind}_payment.json`))
  assert.equal(start.cash.account.balance, 3400)
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1100 } })
    const api = 'http://localhost:8000'
    const access = JSON.parse(fs.readFileSync(path.join(root, 'data/operator_access.json'), 'utf8')).access_key
    const login = await context.request.post(api + '/session', { data: { access_key: access, display_name: 'P9 evidence verification' }, headers: { Origin: 'http://localhost:5173' } })
    assert.equal(login.status(), 200)
    const queue = await (await context.request.get(api + '/tickets')).json()
    const cash = await (await context.request.get(api + '/cash')).json()
    assert.equal(cash.account.balance, 160)
    const originalHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data/campus_customs.db'))).digest('hex')
    assert.equal(originalHash, '23686a90d698f7fa6f901a3f0a9774db9cbb31e13151c9e5717275f3321f360a')
    const tickets = [101, 102, 103].map(id => {
      const dbTicket = queue.tickets.find(t => t.id === id)
      assert.equal(dbTicket.status, 'resolved', `Ticket ${id} is not resolved in the database`)
      const ticketRuns = runs.filter(r => r.ticket === id)
      const final = ticketRuns.at(-1)
      assert.equal(final.job.status, 'completed')
      const runIds = new Set(ticketRuns.map(r => r.run_id))
      const events = audit.filter(e => runIds.has(e.run_id))
      const outcome = [...events].reverse().find(e => e.event === 'mcp_tool_result' && e.data.tool === 'record_ticket_outcome')
      assert.ok(outcome, `No actual outcome tool result for ${id}`)
      const paid = payments.filter(p => p.receipt.action.ticket_id === id)
      return {
        id, status: dbTicket.status, resolution_kind: outcome.data.output.resolution_kind,
        outcome: final.job.result.report.summary, recorded_ticket: dbTicket,
        agents_worked: [...new Set(events.filter(e => e.event === 'agent_start').map(e => e.agent))],
        agent_contributions: events.filter(e => e.event === 'agent_result').map(e => ({ run_id: e.run_id, agent: e.agent, report: e.data.report })),
        delegations: events.filter(e => e.event === 'delegation_start').map(e => ({ run_id: e.run_id, from: e.agent, to: e.data.to, task: e.data.task })),
        tools_used: [...new Set(events.filter(e => e.event === 'mcp_context' || e.event === 'mcp_tool_start').map(e => e.data.tool))],
        human_approvals: paid.map(p => ({ authorization: p.authorization, amount: p.receipt.action.amount, payee: p.receipt.action.details.payee, approved_by: p.receipt.approved_by, payment_id: p.receipt.payment_id, paid_at: p.receipt.paid_at, interface_operated_by: 'Assistant acting on the student’s chat instruction, not an independent student UI click' })),
        cash_change: -paid.reduce((sum, p) => sum + p.receipt.action.amount, 0),
        runs: ticketRuns.map(r => ({ run_id: r.run_id, status: r.job.status, error: r.job.result?.error, evidence_file: `p9_ticket_${id}_${r.run_id}.json` })),
        screenshot: `p9_resolved_${id}.png`, final_run_id: final.run_id,
        customer_message_sent: false, stock_received: false,
      }
    })
    assert.equal(3400 + tickets.reduce((sum, t) => sum + t.cash_change, 0), cash.account.balance)
    const report = { recorded_at_utc: new Date().toISOString(), source: 'Real Chromium dashboard / production FastAPI / MCP / live gpt-6-luna via Portkey; no offline fixture results', shop_date: cash.shop_date, starting_checking_balance: 3400, ending_checking_balance: cash.account.balance, original_database_sha256: originalHash, tickets, payments: payments.map(p => p.receipt), caution: 'Resolved means an operational disposition, not necessarily fulfilled. Deferred outcomes are identified explicitly; no stock receipt or sent communications are claimed.' }
    const runIds = Object.fromEntries(tickets.map(t => [t.id, t.final_run_id]))
    await context.addInitScript(ids => sessionStorage.setItem('campus-run-ids', JSON.stringify(ids)), runIds)
    const page = await context.newPage()
    const browserErrors = []
    page.on('pageerror', e => browserErrors.push(String(e)))
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).waitFor()
    for (const t of tickets) {
      await page.getByRole('button', { name: new RegExp(`^Select ticket ${t.id}:`) }).click()
      await page.locator('.ticket-detail .badge').filter({ hasText: /^resolved$/ }).waitFor()
      await page.getByTestId('cash-balance').filter({ hasText: '$160.00' }).waitFor()
      // Restarts discard in-memory jobs, not durable outcomes. Never inject fake summaries.
      const jobResponse = await context.request.get(api + '/runs/' + t.final_run_id)
      if (jobResponse.status() === 200) {
        await page.getByRole('button', { name: /Agent summaries/ }).click()
        await page.locator('.contribution').first().waitFor()
      }
      await page.screenshot({ path: path.join(out, t.screenshot), fullPage: true, animations: 'disabled' })
    }
    assert.deepEqual(browserErrors, [])
    write('resolved_tickets.json', JSON.stringify(report, null, 2))
    let html = fs.readFileSync(path.join(out, 'desk_tickets.html'), 'utf8')
    const expectedBefore = [...html.matchAll(/<section class="card"><h3>Expected[\s\S]*?<\/section>/g)].map(m => m[0])
    for (const t of tickets) {
      const steps = t.delegations.map(d => `${d.from} → ${d.to} (run ${d.run_id.slice(0, 8)}): ${d.task}`)
      const contributions = t.agent_contributions.map(c => `<details><summary>${esc(c.agent)} · run ${esc(c.run_id.slice(0, 8))}</summary><p>${esc(c.report.summary)}</p></details>`).join('')
      const approvals = t.human_approvals.length ? list(t.human_approvals.map(a => `${money(a.amount)} to ${a.payee}; payment ${a.payment_id}. ${a.authorization}`)) : '<p>No payment or purchase approval was needed; no cash moved.</p>'
      const differences = t.id === 101 ? 'The first run hit its request ceiling after three specialist reports. The retry used Boss → Inventory → Accounting and stopped at a prepared invoice proposal; the final post-payment run added Customer Service and recorded a deferred, not fulfilled, outcome.' : t.id === 102 ? 'The investigation followed Boss → Facilities → Accounting. After the authorized payment, the final run rechecked the rent evidence before Boss recorded the paid result. Actual cash began at $2,560, not the planning snapshot of $3,400.' : 'The Actual handoffs above are taken from observed events, not copied from the Expected plan. The 20-unit request was not fulfilled and no discount or receipt was invented. The shortage and $160 cash constrained the supported disposition.'
      const content = `<p><strong>Recorded status: ${esc(t.status)} · ${esc(t.resolution_kind)}.</strong> ${esc(t.outcome)}</p><h3>Actual agents and handoffs</h3><p>${esc(t.agents_worked.join(', '))}</p>${list(steps)}<h3>Actual MCP tools</h3>${list(t.tools_used)}<h3>Agent contributions</h3>${contributions}<h3>Human authorization and cash</h3>${approvals}<p>Ticket cash change: ${money(t.cash_change)}.</p><h3>Expected versus Actual evidence</h3><p>${esc(differences)}</p><p>Drafts remain unsent; no received stock was recorded. <a href="${esc(t.screenshot)}">Real resolved-board screenshot</a></p>${list(t.runs.map(r => `Run ${r.run_id}: ${r.status}${r.error ? ' — ' + r.error : ''}`))}`
      html = html.replace(new RegExp(`<section class="actual" data-actual-for="${t.id}">[\\s\\S]*?</section>`), `<section class="actual" data-actual-for="${t.id}"><h2>Actual</h2><div class="actual-content">${content}</div></section>`)
    }
    const cashContent = `<div class="card"><span class="eyebrow">Cash · actual P9 run</span><h2>${money(3400)} → ${money(cash.account.balance)}</h2><p>Starting checking balance after the authorized reset: ${money(3400)}.</p><table><thead><tr><th>Ticket</th><th>Actual cash change</th><th>Why</th><th>Balance afterward</th></tr></thead><tbody><tr><td>101</td><td>−$840.00</td><td>Recorded payment of overdue invoice 501 to Bulldog Print Co; tee fulfillment deferred, stock still zero.</td><td>$2,560.00</td></tr><tr><td>102</td><td>−$2,400.00</td><td>Recorded rent payment for lease 1 to Elm City Properties; paid outcome verified.</td><td>$160.00</td></tr><tr><td>103</td><td>$0.00</td><td>No purchase, discount transaction, or revenue was recorded. Twelve missing hoodies at $22 estimate $264, exceeding $160 by $104; supplier quote and SKU mapping remain unverified.</td><td>$160.00</td></tr></tbody></table><p><strong>Reconciliation: $3,400 − $840 − $2,400 + $0 = $160.</strong> Ending cash is read through MCP-backed <code>/cash</code> from the working SQLite checking row.</p><p>Payments were executed by the assistant through the protected UI on the student's chat authorization to proceed with the disclosed obligations. There was no real-world bank transfer and no separately fabricated student click.</p></div>`
    html = html.replace(/<section role="tabpanel" id="cash"[\s\S]*?<\/section>/, `<section role="tabpanel" id="cash" aria-labelledby="tab-cash" hidden>${cashContent}</section>`)
    html = html.replace('Problem 6 · Planning only', 'Problems 6 + 9 · Actual evidence').replace('Plan the handoffs.', 'Compare the plan with the run.').replace('Student-approved expectations for the three open tickets. Compare these plans with the later resolution run; each Actual section is reserved for Problem 9.', 'Student-approved Expected plans and observed P9 outcomes. Deferred decisions are distinguished from fulfillment; cash is reconciled to the working database.')
    assert.deepEqual([...html.matchAll(/<section class="card"><h3>Expected[\s\S]*?<\/section>/g)].map(m => m[0]), expectedBefore, 'Expected sections must be preserved')
    write('desk_tickets.html', html)
    write('resolved_board.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HW5 · Real resolved board</title><style>body{margin:0;background:#f5f6fb;color:#20253c;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:36px 24px}h1{font-size:36px;letter-spacing:-1px}section{background:white;border:1px solid #e2e4ef;border-radius:16px;padding:24px;margin:24px 0}img{display:block;width:100%;height:auto;border:1px solid #e2e4ef;border-radius:10px}small{color:#66708b}a{color:#6552c6}</style></head><body><main><small>Campus Customs · Problem 9 · Real Chromium evidence</small><h1>Three recorded dispositions.</h1><p>Checking: $3,400 − $840 − $2,400 = $160. Screenshots were taken from the actual React dashboard after all three tickets were resolved. “Deferred” is not fulfilled; no stock arrival or sent customer communication is claimed.</p><p><a href="desk_tickets.html">Expected / Actual / Cash</a> · <a href="resolved_tickets.json">Detailed outcomes and authorizations</a></p>${tickets.map(t => `<section><h2>Ticket ${t.id} · ${esc(t.resolution_kind)}</h2><p>${esc(t.outcome)}</p><small>Source: production backend + live Portkey agents; final run ${esc(t.final_run_id)}.</small><img src="${esc(t.screenshot)}" alt="Actual React board showing ticket ${t.id} resolved, final cash $160, and observed agent contributions"></section>`).join('')}<p>Captured ${esc(report.recorded_at_utc)}. Local screenshots are supplied alongside this standalone page; no web server is needed to view it.</p></main></body></html>`)
    write('p9_final_browser_checks.json', JSON.stringify({ recorded_at_utc: report.recorded_at_utc, checks: ['All three status rows are resolved', 'Final cash is $160', 'Actual recorded payment amounts reconcile from $3,400', 'Original database hash unchanged', 'Three real resolved-board screenshots captured', 'Expected sections preserved verbatim', 'No browser page errors'], browser_errors: browserErrors }, null, 2))
    console.log(JSON.stringify({ tickets: tickets.map(t => ({ id: t.id, status: t.status, kind: t.resolution_kind, cash_change: t.cash_change })), cash: cash.account.balance, artifacts: ['desk_tickets.html', 'resolved_tickets.json', 'resolved_board.html', 'p9_final_browser_checks.json'] }))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
