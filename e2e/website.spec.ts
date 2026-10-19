import { expect, test } from '@playwright/test';
import { login, watchErrors } from './helpers';

test('visitors get the public website at / and can send an enquiry', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Homes made for the way Lucknow lives/ })).toBeVisible();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Properties' }).click();
  await expect(page).toHaveURL(/\/homes$/);
  await page.locator('a[href^="/homes/"]').first().click();
  await expect(page).toHaveURL(/\/homes\/[^/]+$/);

  await page.getByRole('tab', { name: 'Enquire' }).click();
  const form = page.getByRole('tabpanel');
  await form.getByLabel('Your name').fill('Dashboard Visitor');
  await form.getByLabel('Mobile number').fill('+91 90000 33344');
  await page.waitForTimeout(3200); // the API rejects forms filled faster than a person could
  await form.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByText('Thank you, we have your request.')).toBeVisible();

  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Staff login' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('signed-in staff get the CRM at / and can still open the website pages', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Website' })).toHaveCount(0);
  await page.goto('/leads?q=Dashboard Visitor');
  await expect(page.getByRole('row', { name: /Dashboard Visitor .* Website/ })).toBeVisible();
  await page.goto('/homes');
  await expect(page.getByRole('heading', { level: 1, name: 'All properties' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Open the CRM' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Website' })).toHaveCount(0);
});
