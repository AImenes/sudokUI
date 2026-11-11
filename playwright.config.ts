// The browser smoke test (tests/e2e) runs against the production build
// served by `vite preview`. Locally a Chromium of your own can be pointed
// at with PW_CHROMIUM=/path/to/chromium; CI installs one.
import { defineConfig } from '@playwright/test';

// PW_PORT lets two checkouts run their browser tests at once, each against
// its own build (a server already on the port is reused outside CI).
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // on GitHub a failure is also an annotation on the commit, which the
  // public API serves without a login (the job's log asks for one)
  reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
