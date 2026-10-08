/* Real Chromium check of the standalone P6 file; no server or model calls. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const url = pathToFileURL(path.join(root, 'output', 'desk_tickets.html')).href;
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(url);
    assert.equal(await page.locator('[role="tab"]').count(), 5);
    for (const [label, id] of [['Ticket 101', 'ticket-101'], ['Ticket 102', 'ticket-102'],
                              ['Ticket 103', 'ticket-103'], ['Cash', 'cash'], ['Reflection', 'reflection']]) {
      const tab = page.getByRole('tab', { name: label, exact: true });
      await tab.click();
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
      assert.equal(await page.locator('[role="tabpanel"]:visible').getAttribute('id'), id);
      checks.push(label + ': selected tab and visible panel agree');
    }
    for (const id of [101, 102, 103]) {
      assert.equal((await page.locator(`#ticket-${id} .actual-content`).textContent()).trim(), '');
      assert.ok(await page.locator(`#ticket-${id} .steps li`).count() >= 3);
    }
    checks.push('Three Actual content areas remain empty; Expected handoffs exist');
    await page.getByRole('tab', { name: 'Ticket 101', exact: true }).click();
    await page.getByRole('tab', { name: 'Ticket 101', exact: true }).press('End');
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), 'Reflection');
    await page.getByRole('tab', { name: 'Reflection', exact: true }).press('ArrowRight');
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').textContent(), 'Ticket 101');
    checks.push('Keyboard End and wrapping ArrowRight navigation work');
    await page.getByRole('tab', { name: 'Ticket 103', exact: true }).click();
    await page.reload();
    assert.equal(await page.locator('[role="tabpanel"]:visible').getAttribute('id'), 'ticket-103');
    checks.push('Selected tab is restored from its URL hash after reload');
    await page.getByRole('tab', { name: 'Ticket 101', exact: true }).click();
    await page.screenshot({ path: path.join(root, 'output', 'p6_desktop.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const label of ['Ticket 101', 'Ticket 102', 'Ticket 103', 'Cash', 'Reflection']) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
    }
    await page.getByRole('tab', { name: 'Ticket 101', exact: true }).click();
    await page.screenshot({ path: path.join(root, 'output', 'p6_mobile.png'), fullPage: true, animations: 'disabled' });
    checks.push('390px mobile layout has no page-level horizontal overflow');
    checks.push('All five tabs also switch correctly at 390px width');
    assert.deepEqual(errors, []);
    checks.push('No browser JavaScript or console errors');
    const evidence = { recorded_at_utc: new Date().toISOString(), browser: 'Chromium',
      opened_as: 'Local file URL (no web server)', checks, errors, passed: true };
    fs.writeFileSync(path.join(root, 'output', 'p6_checks.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
