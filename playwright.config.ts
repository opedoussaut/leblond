import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real local stack:
 *   npx supabase start            (Postgres + Auth + Storage + Mailpit)
 *   node tests/e2e/mock-openai.mjs (only to exercise Patrick without an API key)
 *   npm run build && npm start     (with .env.local pointing at the local stack)
 *   E2E_BASE_URL=http://localhost:3000 E2E_MAILPIT_URL=http://127.0.0.1:54324 npm run test:e2e
 * The suite is skipped when E2E_BASE_URL is not set (e.g. in CI without Supabase).
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
});
