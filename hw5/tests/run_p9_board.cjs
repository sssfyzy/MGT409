/* Real P9 board checkpoint. Never approves payments. Reset requires --reset. */
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const ticket = Number(process.argv.find(x => /^--ticket=/.test(x))?.split('=')[1] || 101)
const reset = process.argv.includes('--reset')
const backend = 'http://localhost:8000'
const out = path.join(root, 'output')
async function waitFor(check, timeout = 180000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Timed out waiting for real P9 run')
}
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1100 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    const access = JSON.parse(fs.readFileSync(path.join(root, 'data/operator_access.json'), 'utf8')).access_key
    const login = await context.request.post(backend + '/session', {
      data: { access_key: access, display_name: 'Student operator — P9' },
      headers: { Origin: 'http://localhost:5173' },
    })
    assert.equal(login.status(), 200)
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: 'Disconnect operator', exact: true }).waitFor()
    if (reset) {
      await page.getByRole('button', { name: 'Reset scenario', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Restore the original scenario data.', exact: true }).check()
      await page.getByRole('button', { name: 'Restore scenario', exact: true }).click()
      await waitFor(async () => await page.getByRole('dialog').count() === 0)
      const cash = await (await context.request.get(backend + '/cash')).json()
      fs.writeFileSync(path.join(out, 'p9_start.json'), JSON.stringify({ timestamp: new Date().toISOString(), cash, reset_via: 'real dashboard; authorized by P9 task approval' }, null, 2))
    }
    await page.getByRole('button', { name: new RegExp(`^Select ticket ${ticket}:`) }).click()
    await page.getByRole('checkbox', { name: /Review only/ }).uncheck()
    const runResponse = page.waitForResponse(r => r.url() === `${backend}/tickets/${ticket}/run` && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Run resolution', exact: true }).click()
    const launched = await runResponse
    assert.equal(launched.status(), 202)
    const { run_id } = await launched.json()
    let job
    await waitFor(async () => {
      job = await (await context.request.get(`${backend}/runs/${run_id}`)).json()
      return !['queued', 'running'].includes(job.status)
    })
    await waitFor(async () => await page.locator('.run-state.live').count() === 0)
    const pending = await (await context.request.get(backend + '/payments/pending')).json()
    const cash = await (await context.request.get(backend + '/cash')).json()
    const queue = await (await context.request.get(backend + '/tickets')).json()
    const events = await (await context.request.get(`${backend}/events?run_id=${run_id}&limit=200`)).json()
    const evidence = { timestamp: new Date().toISOString(), source: 'real dashboard / production backend / Portkey', ticket, run_id, job, pending, cash, queue, events, browser_errors: errors, payment_approved_by_this_script: false }
    const stem = `p9_ticket_${ticket}_${run_id}`
    fs.writeFileSync(path.join(out, stem + '.json'), JSON.stringify(evidence, null, 2))
    await page.screenshot({ path: path.join(out, stem + '.png'), fullPage: true, animations: 'disabled' })
    console.log(JSON.stringify({ evidence: stem + '.json', status: job.status, report: job.result?.report, pending, cash, browser_errors: errors }))
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
