import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

// The suite runs against its own API in demo mode on a throwaway database, behind `vite preview`.
const API_PORT = 7391;
const WEB_PORT = 7390;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'estateflow-e2e-'));

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    // Use a preinstalled Chromium when the bundled one is not downloaded (e.g. offline CI images).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'npx tsx src/index.ts --demo',
      // The browser tests start a demo copy of estateflow-backend from the folder next to this one.
      cwd: path.resolve(here, process.env.EF_BACKEND_DIR || '../estateflow-backend'),
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        DEMO_DATABASE_FILE: path.join(tmp, 'demo.db'),
        UPLOAD_DIR: path.join(tmp, 'uploads'),
        SCHEDULER_INTERVAL_MS: '0',
        RATE_LIMIT_API: '100000',
        RATE_LIMIT_AUTH: '1000',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npx vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
