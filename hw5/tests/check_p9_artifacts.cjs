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
    for (const id of [101, 102, 103]) {
      await page.getByRole('tab', { name: `Ticket ${id}`, exact: true }).click()
      assert.equal(await page.locator(`#ticket-${id}`).isVisible(), true)
      assert.ok((await page.locator(`[data-actual-for="${id}"]`).textContent()).includes('Recorded status: resolved'))
      assert.equal(await page.locator(`#ticket-${id} .columns`).count(), 1)
    }
    await page.getByRole('tab', { name: 'Cash', exact: true }).click()
    assert.equal(await page.locator('#cash tbody tr').count(), 3)
    assert.ok((await page.locator('#cash').textContent()).includes('$3,400 − $840 − $2,400 + $0 = $160'))
    await page.screenshot({ path: path.join(out, 'p9_cash_tab.png'), fullPage: true, animations: 'disabled' })
    await page.getByRole('tab', { name: 'Reflection', exact: true }).click()
    const reflectionText = await page.locator('#reflection').textContent()
    const reflectionComplete = reflectionText.includes('Student reflection')
    assert.ok(reflectionComplete || reflectionText.includes("student's later reflection"))
    await page.goto(pathToFileURL(path.join(out, 'resolved_board.html')).href)
    const images = page.locator('img')
    assert.equal(await images.count(), 3)
    for (let i = 0; i < 3; i++) {
      assert.equal(await images.nth(i).evaluate(img => img.complete && img.naturalWidth > 0), true)
    }
    assert.deepEqual(errors, [])
    const checks = ['All three standalone ticket tabs display real Actual evidence and preserved Expected plans', 'Cash tab has three itemized rows and exact reconciliation', reflectionComplete ? 'Student P10 Reflection remains accessible' : 'Reflection left for student P10 input', 'Resolved board opens as a local file with all three real images', 'No browser script errors']
    fs.writeFileSync(path.join(out, 'p9_artifact_checks.json'), JSON.stringify({ recorded_at_utc: new Date().toISOString(), checks, browser_errors: errors }, null, 2))
    console.log(JSON.stringify({ passed: checks.length, checks }))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
