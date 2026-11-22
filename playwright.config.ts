import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a running app with the seeded database (npm run db:seed).
 * Locally: `npm run dev` in one terminal, `npm run test:e2e` in another
 * (or let Playwright start the dev server).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {} } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {} }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
