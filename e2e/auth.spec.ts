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

test('customers are refused and pointed to the mobile app', async ({ page }) => {
  watchErrors(page);
  await fillLogin(page, DEMO.customer.email, DEMO.customer.password);
  await expect(page.getByText(/mobile app/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
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
