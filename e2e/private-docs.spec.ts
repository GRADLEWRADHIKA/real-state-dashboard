import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('accounts uploads an office paper; the sales manager has no Office tab', async ({ page, browser }) => {
  await login(page, 'accounts');
  await page.goto('/documents');
  await page.getByRole('tab', { name: 'Office' }).click();
  await page.getByRole('button', { name: 'Upload to Office' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'october-sales.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') });
  await dialog.getByRole('button', { name: /^Upload/ }).last().click();
  await expect(page.getByText('october-sales.pdf').first()).toBeVisible();

  const other = await browser.newPage();
  await login(other, 'manager');
  await other.goto('/documents');
  await expect(other.getByRole('tab', { name: 'Office' })).toHaveCount(0);
  await other.close();
});
