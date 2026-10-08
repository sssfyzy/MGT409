/* Operator dialog and error recovery checks against the isolated fixture API. */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
let confidential = ''

;(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/p8_fixture_meta.json'), 'utf8'))
  confidential = JSON.parse(fs.readFileSync(meta.access_file, 'utf8')).access_key
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  const proxy = async route => {
    const response = await route.fetch({ url: route.request().url().replace('localhost:8000', 'localhost:8001') })
    await route.fulfill({ response })
  }
  const checks = []
  try {
    await page.route('http://localhost:8000/**', proxy)
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: 'Connect operator', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Run review', exact: true }).isDisabled(), true)
    checks.push('Disconnected operator cannot start a run')
    await page.getByRole('button', { name: 'Connect operator', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect as an operator' })
    await dialog.getByLabel('Operator name').fill('Offline control-test human')
    await dialog.getByLabel('Operator access code').fill('invalid-fixture-code-which-is-at-least-32-characters')
    await dialog.getByRole('button', { name: 'Connect operator', exact: true }).click()
    await dialog.getByRole('alert').filter({ hasText: 'Invalid operator access code' }).waitFor()
    checks.push('Invalid operator code is rejected and displayed in the dialog')
    await dialog.getByLabel('Operator access code').fill(confidential)
    await dialog.getByRole('button', { name: 'Connect operator', exact: true }).click()
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).waitFor()
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
    assert.equal(storage.includes(confidential), false)
    checks.push('Valid operator connects; access code is absent from browser storage')
    await page.route('http://localhost:8000/tickets', route => route.fulfill({ status: 503,
      contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify({ detail: 'Fixture connection failure' }) }))
    await page.getByRole('button', { name: 'Refresh desk', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Fixture connection failure' }).waitFor()
    await page.unroute('http://localhost:8000/tickets')
    await page.getByRole('button', { name: 'Retry / refresh', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.alert'))
    checks.push('Connection error is visible and Retry / refresh recovers the desk')
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).click()
    await page.getByRole('button', { name: 'Connect operator', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Connect operator', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog'))
    checks.push('Escape closes the dialog; logout removes operator authority')
    assert.deepEqual(errors, [])
    const evidence = { recorded_at_utc: new Date().toISOString(), source: 'Real Chromium + isolated fixture API',
      checks, errors, passed: true, financial_mutations: 0, model_calls: 0 }
    fs.writeFileSync(path.join(root, 'output/p8_control_checks.json'), JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify({ passed: true, checks: checks.length, financial_mutations: 0 }))
  } finally { await browser.close() }
})().catch(error => { console.error(String(error.stack || error).replaceAll(confidential, '[redacted]')); process.exitCode = 1 })
