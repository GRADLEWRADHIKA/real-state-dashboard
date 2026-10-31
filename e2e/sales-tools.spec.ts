import { expect, test } from '@playwright/test';
import { login, settled, watchErrors } from './helpers';

test('manager opens Lead insights and sees stuck leads', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'manager');
  // The dashboard card links through to the insights page.
  await expect(page.getByTestId('stuck-leads-card')).toBeVisible();
  await page.getByTestId('stuck-leads-card').getByRole('link', { name: /Insights/ }).click();
  await expect(page).toHaveURL(/\/leads\/insights$/);
  await settled(page);
  await expect(page.getByRole('heading', { name: 'Lead insights' })).toBeVisible();
  const stuck = page.getByTestId('stuck-leads');
  await expect(stuck.getByRole('row').nth(1)).toBeVisible();
  await expect(stuck.getByRole('link', { name: /^Call / }).first()).toBeVisible();
  await expect(page.getByText('Stuck by executive')).toBeVisible();
  // A shorter idle window never shows fewer stuck leads.
  const at7 = await stuck.getByRole('row').count();
  await page.getByRole('radio', { name: '3 days' }).click();
  await expect.poll(() => stuck.getByRole('row').count()).toBeGreaterThanOrEqual(at7);
  // The leads list carries the score column.
  await page.goto('/leads');
  await settled(page);
  await expect(page.getByRole('columnheader', { name: 'Score' })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('sales holds a plot for a lead, then the manager releases it', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'sales');
  await page.goto('/properties?status=Available&type=Plot');
  await settled(page);
  await page.locator('main a[href^="/properties/"]').first().click();
  await expect(page).toHaveURL(/\/properties\/\d+$/);
  const url = page.url();
  await page.getByRole('button', { name: 'Hold for buyer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Hold for \(days\)/)).toHaveValue('3');
  await dialog.locator('ul button').first().click();
  await dialog.getByLabel('Note', { exact: true }).fill('Token expected on Monday');
  await dialog.getByRole('button', { name: 'Place hold' }).click();
  await expect(page.getByText(/on hold until/)).toBeVisible();
  const banner = page.getByTestId('hold-banner');
  await expect(banner).toContainText(/On hold for .+ until .+ \(\d+ days? left\) by Rahul Verma/);

  await login(page, 'manager');
  await page.goto(url);
  await expect(page.getByTestId('hold-banner')).toBeVisible();
  await page.getByTestId('hold-banner').getByRole('button', { name: 'Release' }).click();
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Release' }).click();
  await expect(page.getByText('Hold released. The unit is available again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hold for buyer' })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('accounts records a refund on the cancelled booking and downloads the receipt', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await login(page, 'accounts');
  await page.goto('/refunds');
  await settled(page);
  const row = page.getByTestId('refund-queue').getByRole('row', { name: /Priyanka Shukla/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Record refund' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Deduction', { exact: true }).fill('50000');
  await expect(dialog.getByTestId('refund-amount')).toBeVisible();
  // A deduction needs a reason before it can be saved.
  await dialog.getByRole('button', { name: /^Record refund of/ }).click();
  await expect(dialog.getByText('Say why the deduction is kept')).toBeVisible();
  await dialog.getByLabel(/Reason for deduction/).fill('Cancellation charges as per agreement');
  await dialog.getByLabel('Reference', { exact: true }).fill('UTR-REFUND-1');
  await dialog.getByRole('button', { name: /^Record refund of/ }).click();
  await expect(page.getByText(/Refund RF\/.+ recorded/)).toBeVisible();
  await expect(page.getByTestId('refund-queue').getByRole('row', { name: /Priyanka Shukla/ })).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download receipt RF/ }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^RF-.+\.pdf$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('manager sees the Feedback page', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'manager');
  await page.getByRole('navigation').first().getByRole('link', { name: 'Feedback' }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await settled(page);
  await expect(page.getByTestId('feedback-kind-site_visit')).toContainText(/\d\.\d/);
  await expect(page.getByText('Rating distribution')).toBeVisible();
  await expect(page.getByText('Site visits by executive')).toBeVisible();
  await expect(page.getByTestId('feedback-list').getByRole('listitem').first()).toBeVisible();
  await page.getByLabel('All kinds').selectOption('general');
  await expect(page.getByTestId('feedback-list')).toContainText('Construction updates are regular');
  expect(errors, errors.join('\n')).toEqual([]);
});
