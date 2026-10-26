import { expect, test } from '@playwright/test';
import { DEMO, fillLogin, login, watchErrors } from './helpers';

test('staff sign in and land on their home screen', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Revenue collected')).toBeVisible();
  await login(page, 'accounts');
  await expect(page).toHaveURL(/\/finance$/);
  expect(errors).toEqual([]);
});

test('customers land on their own portal Home', async ({ page }) => {
  const errors = watchErrors(page);
  await fillLogin(page, DEMO.customer.email, DEMO.customer.password);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Your property', { exact: true })).toBeVisible();
  await expect(page.getByText('Payment summary')).toBeVisible();
  // Staff screens are not available: they fall back to the portal Home, without staff navigation.
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Leads' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('customer opens Home, Payments and Documents on the dashboard', async ({ page }) => {
  const errors = watchErrors(page);
  await fillLogin(page, DEMO.customer.email, DEMO.customer.password);
  await expect(page.getByText('Your property', { exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary', exact: true });
  await nav.getByRole('link', { name: 'Payments' }).click();
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.getByRole('heading', { name: 'Instalment schedule' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  await nav.getByRole('link', { name: 'Documents' }).click();
  await expect(page).toHaveURL(/\/documents$/);
  await expect(page.getByRole('button', { name: 'Upload document' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload document' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a wrong password shows an error and stays on the sign-in screen', async ({ page }) => {
  await fillLogin(page, DEMO.sales.email, 'Wrong@1234');
  await expect(page.getByText(/incorrect|invalid/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('signing out returns to the sign-in screen and protects pages', async ({ page }) => {
  await login(page, 'manager');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login/);
});

test('forgotten password: request, code issued by an admin, reset, sign in', async ({ browser }) => {
  const user = await browser.newPage();
  await user.goto('/login');
  await user.getByRole('button', { name: 'Forgot password?' }).click();
  await user.getByLabel('Work email').fill('arjun@demo.com');
  await user.getByRole('button', { name: 'Send request' }).click();
  await expect(user.getByText(/administrator/i).first()).toBeVisible();

  const admin = await browser.newPage();
  await login(admin, 'admin');
  await admin.goto('/users?tab=resets');
  const row = admin.getByRole('row').filter({ hasText: 'arjun@demo.com' }).first();
  await row.getByRole('button', { name: /Issue (new )?code/ }).click();
  const code = (await admin.getByTestId('reset-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  await user.getByRole('button', { name: 'Enter reset code' }).click();
  await user.getByPlaceholder('8 characters').fill(code);
  await user.getByLabel('New password').fill('Fresh@2026');
  await user.getByRole('button', { name: 'Set new password' }).click();
  await expect(user.getByText(/Your password has been changed/)).toBeVisible();

  await user.keyboard.press('Escape');
  await fillLogin(user, 'arjun@demo.com', 'Fresh@2026');
  await expect(user).not.toHaveURL(/\/login/);
});
