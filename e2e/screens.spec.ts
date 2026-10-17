import { expect, test } from '@playwright/test';
import { login, settled, watchErrors, type DemoRole } from './helpers';

/**
 * Opens every screen each role can reach and fails on error states, console errors, uncaught
 * exceptions or API calls that come back 4xx/5xx.
 */
const SCREENS: Record<Exclude<DemoRole, 'customer'>, string[]> = {
  admin: ['/', '/leads', '/leads/1', '/pipeline', '/site-visits', '/followups', '/customers', '/customers/6', '/deals', '/requests', '/properties', '/properties/1', '/tasks', '/finance', '/finance/transactions', '/finance/installments', '/documents', '/reports', '/users', '/users?tab=resets', '/audit', '/settings'],
  manager: ['/', '/leads', '/pipeline', '/site-visits', '/followups', '/customers', '/deals', '/requests', '/properties', '/tasks', '/documents', '/reports', '/users', '/settings'],
  sales: ['/', '/leads', '/pipeline', '/site-visits', '/followups', '/customers', '/deals', '/requests', '/properties', '/tasks', '/documents', '/settings'],
  accounts: ['/finance', '/finance/transactions', '/finance/installments', '/customers', '/requests', '/properties', '/tasks', '/documents', '/reports', '/settings'],
};

for (const [role, paths] of Object.entries(SCREENS) as [Exclude<DemoRole, 'customer'>, string[]][]) {
  test(`${role}: every screen loads cleanly`, async ({ page }) => {
    const errors = watchErrors(page);
    await login(page, role);
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await settled(page);
      await expect(page.getByText('Couldn’t load this data'), `${role} ${path}`).toHaveCount(0);
      await expect(page.getByText('This page doesn’t exist'), `${role} ${path}`).toHaveCount(0);
      expect(new URL(page.url()).pathname, `${role} was redirected away from ${path}`).toBe(path.split('?')[0]);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('calendar views render on visits, follow-ups and tasks', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, 'admin');
  await page.goto('/site-visits');
  await page.getByRole('radio', { name: 'Calendar' }).click();
  await expect(page.locator('[data-date]').first()).toBeVisible();
  await page.goto('/followups');
  await page.getByRole('button', { name: 'Calendar' }).click();
  await expect(page.locator('[data-date]').first()).toBeVisible();
  await page.goto('/tasks');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.locator('[data-date]').first()).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('navigation only offers what the role can open', async ({ page }) => {
  await login(page, 'sales');
  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: 'Leads' })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Users/ })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Reports' })).toHaveCount(0);
  await page.goto('/audit');
  await expect(page).toHaveURL(/\/$/);

  await login(page, 'accounts');
  const nav2 = page.getByRole('navigation').first();
  await expect(nav2.getByRole('link', { name: 'Transactions' })).toBeVisible();
  await expect(nav2.getByRole('link', { name: 'Leads' })).toHaveCount(0);
});
