/* Execute only the disclosed P9 invoice/rent obligations authorized in student chat.
 * This changes the homework SQLite copy, never calls a banking/payment service.
 * Purchase proposals are deliberately excluded. */
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const kind = process.argv[2]
const expected = { invoice: { ticket: 101, ref: 501, payee: 'Bulldog Print Co', amount: 840 }, rent: { ticket: 102, ref: 1, payee: 'Elm City Properties', amount: 2400 } }[kind]
assert.ok(expected, 'Only the disclosed invoice and rent are allowed')
const backend = 'http://localhost:8000'
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1100 } })
    const access = JSON.parse(fs.readFileSync(path.join(root, 'data/operator_access.json'), 'utf8')).access_key
    const connected = await context.request.post(backend + '/session', { data: { access_key: access, display_name: 'Student-authorized P9 operator' }, headers: { Origin: 'http://localhost:5173' } })
    assert.equal(connected.status(), 200)
    const { proposals } = await (await context.request.get(backend + '/payments/pending')).json()
    const proposal = proposals.find(p => p.action.kind === kind && p.action.ticket_id === expected.ticket)
    assert.ok(proposal, 'An agent-prepared pending proposal must exist')
    assert.equal(proposal.action.amount, expected.amount)
    assert.equal(proposal.action.ref_id, expected.ref)
    assert.equal(proposal.action.details.payee, expected.payee)
    assert.equal(proposal.action.account, 'checking')
    assert.equal(proposal.ready_for_approval, true)
    assert.deepEqual(proposal.blockers, [])
    assert.deepEqual(proposal.assumptions, [])
    const cashBefore = await (await context.request.get(backend + '/cash')).json()
    assert.equal(cashBefore.account.balance, proposal.action.balance_before, 'Reject stale cash')
    const page = await context.newPage()
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).waitFor()
    await page.getByRole('button', { name: new RegExp(`^Select ticket ${expected.ticket}:`) }).click()
    // Find the matching decision card without relying on ticket ordering.
    const review = page.getByRole('button', { name: 'Review payment', exact: true })
    assert.equal(await review.count(), 1, 'Do not ambiguously approve among multiple proposals')
    await review.click()
    const confirm = page.getByRole('button', { name: `Confirm ${money(expected.amount)} payment`, exact: true })
    assert.equal(await confirm.isDisabled(), true)
    await page.screenshot({ path: path.join(root, `output/p9_${kind}_before_approval.png`), fullPage: true, animations: 'disabled' })
    await page.getByRole('checkbox', { name: `I approve this exact ${money(expected.amount)} payment.`, exact: true }).check()
    const responsePromise = page.waitForResponse(r => r.url() === backend + '/payments/approve' && r.request().method() === 'POST')
    await confirm.click()
    const response = await responsePromise
    const receipt = await response.json()
    assert.equal(response.status(), 200, JSON.stringify(receipt))
    const cashAfter = await (await context.request.get(backend + '/cash')).json()
    assert.equal(cashAfter.account.balance, cashBefore.account.balance - expected.amount)
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await page.getByTestId('cash-balance').filter({ hasText: money(cashAfter.account.balance) }).waitFor()
    await page.screenshot({ path: path.join(root, `output/p9_${kind}_after_approval.png`), fullPage: true, animations: 'disabled' })
    const evidence = { timestamp: new Date().toISOString(), source: 'real dashboard / protected backend / MCP / working SQLite only', authorization: 'Student chat: proceed with the disclosed existing homework obligations, translated and recorded in AI_prompts.md; assistant operates UI on that instruction', proposal, cashBefore, receipt, cashAfter }
    fs.writeFileSync(path.join(root, `output/p9_${kind}_payment.json`), JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify(evidence))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
