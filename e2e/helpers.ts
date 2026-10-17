import { expect, type Page } from '@playwright/test';

export const DEMO = {
  admin: { email: 'admin@demo.com', password: 'Admin@123' },
  manager: { email: 'manager@demo.com', password: 'Manager@123' },
  sales: { email: 'sales@demo.com', password: 'Sales@123' },
  accounts: { email: 'accounts@demo.com', password: 'Accounts@123' },
  customer: { email: 'customer@demo.com', password: 'Customer@123' },
} as const;
export type DemoRole = keyof typeof DEMO;

export async function fillLogin(page: Page, email: string, password: string) {
  // Start signed out: a stored session would send /login straight to the home screen.
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('ef_session');
    sessionStorage.removeItem('ef_session');
  });
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
}

export async function login(page: Page, role: Exclude<DemoRole, 'customer'>) {
  await fillLogin(page, DEMO[role].email, DEMO[role].password);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('navigation').first()).toBeVisible();
}

/**
 * Collects browser console errors, uncaught exceptions and failed API calls for a test, so a page
 * that "renders" but logs errors or hits a 4xx/5xx still fails.
 */
export function watchErrors(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !allow.some((r) => r.test(m.text()))) problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') && r.status() >= 400 && !allow.some((a) => a.test(`${r.status()} ${url}`))) problems.push(`api ${r.status()} ${r.request().method()} ${url}`);
  });
  return problems;
}

/** Waits for a screen's data: skeletons gone. (Network-idle never settles because of the live event stream.) */
export async function settled(page: Page) {
  await expect(page.locator('main .skeleton')).toHaveCount(0, { timeout: 15_000 });
}
