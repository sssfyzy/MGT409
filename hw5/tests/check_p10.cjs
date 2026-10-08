/* Real local-file browser verification of the student-authored P10 reflection. */
const { chromium } = require('playwright')
const { pathToFileURL } = require('node:url')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const out = path.resolve(__dirname, '../output')
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(pathToFileURL(path.join(out, 'desk_tickets.html')).href)
    await page.getByRole('tab', { name: 'Reflection', exact: true }).click()
    const text = await page.locator('#reflection').textContent()
    assert.ok(text.includes('average') && text.includes('efficiency'))
    assert.ok(text.includes('For rent, I would use one agent plus tools'))
    for (const id of [101, 102, 103]) assert.ok(text.includes(`Ticket ${id}`))
    assert.equal(await page.locator('#reflection ol').count(), 2)
    for (const list of await page.locator('#reflection ol').all()) assert.equal(await list.locator(':scope > li').count(), 3)
    assert.ok(text.includes('Expected') && text.includes('Actual'))
    assert.ok(text.includes('not an agent approving itself'))
    assert.ok(text.includes('deferred outcomes'))
    assert.ok(text.includes('supplier quote/availability') && text.includes('email integration') && text.includes('refund execution'))
    assert.equal(/[\u3400-\u9fff]/.test(text), false)
    await page.screenshot({ path: path.join(out, 'p10_reflection_desktop.png'), fullPage: true, animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    await page.screenshot({ path: path.join(out, 'p10_reflection_mobile.png'), fullPage: true, animations: 'disabled' })
    await page.getByRole('tab', { name: 'Cash', exact: true }).click()
    assert.ok((await page.locator('#cash').textContent()).includes('$3,400 − $840 − $2,400 + $0 = $160'))
    for (const id of [101, 102, 103]) {
      await page.getByRole('tab', { name: `Ticket ${id}`, exact: true }).click()
      assert.ok((await page.locator(`[data-actual-for="${id}"]`).textContent()).includes('Recorded status: resolved'))
      assert.equal(await page.locator(`#ticket-${id} .columns`).count(), 1)
    }
    assert.deepEqual(errors, [])
    const checks = ['Student’s average/efficiency-first assessment retained in English', 'All three tickets evaluated with Actual versus Expected details', 'Single-agent rent and multi-agent complex-task judgment retained', 'Three solvable and three unsupported scenarios with concrete tools/roles', 'Authorization, deferred outcomes and cash limits described honestly', 'Local-file Reflection tab works on desktop', '390px mobile view has no page-wide horizontal overflow', 'P9 ticket evidence and cash reconciliation remain accessible', 'No browser page errors']
    fs.writeFileSync(path.join(out, 'p10_checks.json'), JSON.stringify({ recorded_at_utc: new Date().toISOString(), source: 'Real Chromium local-file test', checks, browser_errors: errors }, null, 2))
    console.log(JSON.stringify({ passed: checks.length, checks }))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
