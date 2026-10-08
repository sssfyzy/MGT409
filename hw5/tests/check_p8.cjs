/* Real Chromium UI checks. Default mode modifies only an isolated fixture database. */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const live = process.argv.includes('--live')
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const hashes = () => Object.fromEntries(['campus_customs.db', 'campus_customs_new.db'].map(n => [n, hash(path.join(root, 'data', n))]))
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

async function eventually(check, timeout = 180000) {
  const deadline = Date.now() + timeout
  let last
  while (Date.now() < deadline) {
    try { if (await check()) return } catch (e) { last = e }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw last || new Error('Timed out waiting for the actual UI state')
}

(async () => {
  const before = hashes()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1536, height: 1050 } })
  const page = await context.newPage()
  const errors = []
  const checks = []
  page.on('pageerror', error => errors.push(String(error)))
  const fixtureMeta = live ? null : JSON.parse(fs.readFileSync(path.join(root, 'data/p8_fixture_meta.json'), 'utf8'))
  const accessFile = live ? path.join(root, 'data/operator_access.json') : fixtureMeta.access_file
  const access = JSON.parse(fs.readFileSync(accessFile, 'utf8')).access_key
  const backend = live ? 'http://localhost:8000' : 'http://localhost:8001'
  try {
    if (!live) await page.route('http://localhost:8000/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('localhost:8000', 'localhost:8001') })
      await route.fulfill({ response })
    })
    const connected = await context.request.post(backend + '/session', {
      data: { access_key: access, display_name: live ? 'P8 read-only verification' : 'Offline browser fixture operator' },
      headers: { Origin: 'http://localhost:5173' },
    })
    assert.equal(connected.status(), 200)
    if (!live) {
      const reset = await context.request.post(backend + '/reset', {
        data: { confirm: true }, headers: { Origin: 'http://localhost:5173',
          'X-CSRF-Token': (await connected.json()).csrf_token },
      })
      assert.equal(reset.status(), 200)
    }
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).waitFor()
    await eventually(async () => (await page.getByTestId('cash-balance').textContent()) === money(3400))
    assert.equal(await page.locator('.ticket-button').count(), 3)
    for (const id of [101, 102, 103]) {
      await page.getByRole('button', { name: new RegExp(`^Select ticket ${id}:`) }).click()
      assert.equal(await page.locator('.ticket-detail .tiny-label').textContent(), `TICKET ${id}`)
    }
    checks.push('All three database tickets load and can be selected')
    await page.getByRole('button', { name: /^Select ticket 102:/ }).click()
    const review = page.getByRole('checkbox', { name: /Review only/ })
    assert.equal(await review.isChecked(), true)
    await eventually(() => page.getByRole('button', { name: 'Run review', exact: true }).isEnabled())
    await page.getByRole('button', { name: 'Run review', exact: true }).click()
    await eventually(async () => await page.locator('.run-state.live').count() > 0)
    checks.push('A real asynchronous run appears live in the browser')
    await eventually(async () => (await page.locator('.run-state').textContent()) === 'Review ready')
    await page.getByText('Boss → Facilities', { exact: true }).waitFor()
    await page.getByText('Facilities → Accounting', { exact: true }).waitFor()
    checks.push('Actual Boss-to-Facilities and Facilities-to-Accounting handoffs are rendered')
    assert.equal(await page.locator('.ticket-detail .badge').textContent(), 'open')
    assert.equal(await page.getByTestId('cash-balance').textContent(), money(3400))
    checks.push('Completed review does not falsely resolve a ticket or change cash')
    await page.getByRole('button', { name: /Agent summaries/ }).click()
    await page.getByRole('heading', { name: 'Accounting', exact: true }).waitFor()
    assert.ok(await page.locator('.contribution').count() >= 3)
    checks.push('Actual per-agent contribution summaries are available')
    await page.screenshot({ path: path.join(root, 'output', live ? 'p8_live_desktop.png' : 'p8_fixture_desktop.png'), fullPage: true, animations: 'disabled' })

    if (!live) {
      async function approve(amount, purchase = false) {
        await eventually(() => page.getByRole('button', { name: 'Review payment', exact: true }).isEnabled())
        await page.getByRole('button', { name: 'Review payment', exact: true }).click()
        const confirm = page.getByRole('button', { name: `Confirm ${money(amount)} payment`, exact: true })
        assert.equal(await confirm.isDisabled(), true)
        assert.equal(await page.getByTestId('cash-balance').textContent(), money(amount === 2400 ? 3400 : amount === 840 ? 1000 : 3400))
        if (amount === 2400) await page.screenshot({ path: path.join(root, 'output/p8_fixture_payment_review.png'), animations: 'disabled' })
        await page.getByRole('checkbox', { name: `I approve this exact ${money(amount)} payment.`, exact: true }).check()
        if (purchase) {
          assert.equal(await confirm.isDisabled(), true)
          await page.getByRole('checkbox', { name: 'I have reviewed and confirm these purchase assumptions.', exact: true }).check()
        }
        await confirm.click()
        await eventually(async () => await page.getByRole('dialog').count() === 0)
      }
      await approve(2400)
      await eventually(async () => (await page.getByTestId('cash-balance').textContent()) === money(1000))
      checks.push('Opening payment review does not pay; explicit confirmation updates fixture cash to $1,000')
      await review.uncheck()
      await page.getByRole('button', { name: 'Run resolution', exact: true }).click()
      await eventually(async () => (await page.locator('.ticket-detail .badge').textContent()) === 'resolved')
      checks.push('A ticket becomes resolved only after the backend records its verified outcome')
      await page.screenshot({ path: path.join(root, 'output/p8_fixture_resolved.png'), fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: /^Select ticket 101:/ }).click()
      await review.check()
      await eventually(() => page.getByRole('button', { name: 'Run review', exact: true }).isEnabled())
      await page.getByRole('button', { name: 'Run review', exact: true }).click()
      await eventually(async () => (await page.locator('.run-state').textContent()) === 'Review ready')
      await approve(840)
      await eventually(async () => (await page.getByTestId('cash-balance').textContent()) === money(160))
      await page.getByRole('button', { name: /^Select ticket 103:/ }).click()
      await eventually(() => page.getByRole('button', { name: 'Run review', exact: true }).isEnabled())
      await page.getByRole('button', { name: 'Run review', exact: true }).click()
      await eventually(async () => (await page.locator('.run-state').textContent()) === 'Review ready')
      assert.ok((await page.locator('.proposal-warning').textContent()).includes('Insufficient cash'))
      assert.equal(await page.getByRole('button', { name: 'Review payment', exact: true }).isDisabled(), true)
      checks.push('Insufficient-cash purchase is visibly blocked with a disabled payment action')
      await page.screenshot({ path: path.join(root, 'output/p8_fixture_blocked.png'), fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: 'Reset scenario', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Restore scenario', exact: true }).isDisabled(), true)
      await page.getByRole('checkbox', { name: 'Restore the original scenario data.', exact: true }).check()
      await page.getByRole('button', { name: 'Restore scenario', exact: true }).click()
      await eventually(async () => (await page.getByTestId('cash-balance').textContent()) === money(3400))
      await eventually(async () => await page.locator('.proposal-card').count() === 0)
      checks.push('Explicit fixture reset restores cash and invalidates pending proposals')
      await eventually(() => page.getByRole('button', { name: 'Run review', exact: true }).isEnabled())
      await page.getByRole('button', { name: 'Run review', exact: true }).click()
      await eventually(async () => (await page.locator('.run-state').textContent()) === 'Review ready')
      await approve(264, true)
      await eventually(async () => (await page.getByTestId('cash-balance').textContent()) === money(3136))
      checks.push('Purchase confirmation requires both exact-payment and assumption checkboxes')
    }
    await page.reload()
    await eventually(async () => (await page.locator('.ticket-detail .tiny-label').textContent()) === `TICKET ${live ? 102 : 103}`)
    await eventually(async () => await page.locator('.run-state').count() > 0)
    checks.push('Page reload restores selected ticket and its actual run result without storing credentials')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(root, 'output', live ? 'p8_live_mobile.png' : 'p8_fixture_mobile.png'), fullPage: true, animations: 'disabled' })
    checks.push('390px mobile layout has no page-level horizontal overflow')
    assert.deepEqual(errors, [])
    checks.push('No browser JavaScript exceptions')
    const after = hashes()
    assert.deepEqual(after, before)
    const jobId = JSON.parse(await page.evaluate(() => sessionStorage.getItem('campus-run-ids') || '{}'))[live ? 102 : 103]
    const jobResponse = await context.request.get(backend + '/runs/' + jobId)
    const job = await jobResponse.json()
    const evidence = { recorded_at_utc: new Date().toISOString(),
      source: live ? 'Real Chromium + production API + authorized read-only gpt-6-luna via Portkey' : 'Real Chromium + fixture HTTP proxy + P7 API/MCP + offline model double + disposable SQLite',
      checks, errors, passed: true, database_hashes_before: before, database_hashes_after: after,
      final_run: job, fixture_database: fixtureMeta?.database || null }
    fs.writeFileSync(path.join(root, 'output', live ? 'p8_live_browser.json' : 'p8_browser_checks.json'), JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify({ passed: true, mode: live ? 'live_read_only' : 'isolated_fixture', checks: checks.length, run_id: job.run_id, databases_unchanged: true }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
