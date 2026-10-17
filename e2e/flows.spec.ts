import { expect, test } from '@playwright/test';
import { login, settled, watchErrors } from './helpers';

test('create a lead, see the duplicate warning, then change its status inline', async ({ page }) => {
  const errors = watchErrors(page, [/409 .*\/api\/leads$/]);
  await login(page, 'sales');
  await page.goto('/leads?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Playwright Buyer');
  // An existing customer's number triggers the live duplicate warning.
  await dialog.getByLabel('Phone').fill('+91 98391 22047');
  await expect(dialog.getByText(/Already a lead/)).toBeVisible();
  await dialog.getByLabel('Phone').fill('+91 99887 76655');
  await expect(dialog.getByText(/Already a lead/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByText(/Lead LD-\d+ created/)).toBeVisible();

  await page.goto('/leads?q=Playwright');
  await settled(page);
  const status = page.getByLabel('Status of Playwright Buyer');
  await status.selectOption('Contacted');
  await expect(page.getByText('Moved to Contacted')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('record an installment payment and download the server-generated receipt', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'accounts');
  await page.goto('/finance/installments?range=all');
  await settled(page);
  await page.getByRole('button', { name: 'Record' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Amount received').fill('10000');
  await dialog.getByLabel(/Reference/).fill('UTR-PLAYWRIGHT-1');
  await dialog.getByRole('button', { name: /^Record/ }).click();
  await page.getByRole('button', { name: 'View receipt' }).click();
  await expect(page).toHaveURL(/\/receipts\/\d+/);
  await expect(page.getByText(/RCPT|SWR/).first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('reports export CSV and PDF from the server', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/reports');
  await settled(page);
  await page.getByRole('button', { name: 'Receivables ageing' }).click();
  await expect(page.getByText('Overdue by customer')).toBeVisible();
  for (const fmt of ['CSV', 'PDF']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: fmt, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${fmt.toLowerCase()}$`));
  }
});

test('lead capture key is shown once and accepted by the public endpoint', async ({ page, request }) => {
  await login(page, 'admin');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Lead capture' }).click();
  await page.getByRole('button', { name: /Generate (new )?key/ }).click();
  const confirm = page.getByRole('button', { name: 'Generate new key' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  const key = (await page.getByTestId('lead-capture-key').textContent())!.trim();
  expect(key).toMatch(/^efk_/);
  const res = await request.post('/api/public/leads', { headers: { 'X-Api-Key': key }, data: { name: 'Website Visitor', phone: '9811122233', message: 'Brochure please' } });
  expect(res.status()).toBe(201);
  const bad = await request.post('/api/public/leads', { headers: { 'X-Api-Key': 'efk_wrong' }, data: { name: 'Website Visitor', phone: '9811122234' } });
  expect(bad.status()).toBe(401);
});

test('reply to a customer request from the inbox', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'manager');
  await page.goto('/requests');
  await settled(page);
  await page.getByRole('row').nth(1).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reply to customer').fill('Confirmed for Saturday 11 AM at the site office.');
  await dialog.getByLabel('Status').selectOption('Resolved');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Request updated/)).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('admin users: issue a reset code and see the audit trail', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/users');
  await settled(page);
  await page.getByRole('button', { name: 'Actions for Sneha Tripathi' }).click();
  await page.getByRole('menuitem', { name: 'Issue reset code' }).click();
  await expect(page.getByTestId('reset-code')).toHaveText(/^[A-Z0-9]{8}$/);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto('/audit');
  await settled(page);
  await expect(page.getByRole('table').getByText(/Issued a reset code for Sneha Tripathi/)).toBeVisible();
});

test('drag a lead card between pipeline stages and keep the move after a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'sales');
  await page.goto('/pipeline');
  await settled(page);
  const column = (name: string) => page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const card = column('New lead').locator('.cursor-grab').first();
  const name = (await card.getByRole('link').innerText()).trim();
  const from = await card.boundingBox();
  const to = await column('Contacted').locator('.border-dashed').boundingBox();
  if (!from || !to) throw new Error('Pipeline columns did not render');
  // dnd-kit's pointer sensor needs real movement past its 6px activation distance.
  await page.mouse.move(from.x + from.width / 2, from.y + 40);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + 50, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText(`${name} moved to Contacted`)).toBeVisible();
  await expect(column('Contacted').getByRole('link', { name, exact: true })).toBeVisible();

  await page.reload();
  await settled(page);
  await expect(column('Contacted').getByRole('link', { name, exact: true })).toBeVisible();
  await expect(column('New lead').getByRole('link', { name, exact: true })).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});
