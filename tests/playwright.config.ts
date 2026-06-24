import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright test harness for the Temporal + Supabase chess app.
 *
 * Three layers, each as its own project:
 *  - unit:        pure, deterministic logic exercised through the side-effect-free
 *                 /api/classics endpoints (no Temporal workflow, no DB writes).
 *  - integration: the full FastAPI -> Temporal -> Supabase game flow.
 *  - e2e:         the real browser UI driving the whole stack.
 *
 * The app is expected to be running (docker compose up). Override the target with
 * BASE_URL, e.g. BASE_URL=http://localhost:8095 npx playwright test.
 */
const baseURL = process.env.BASE_URL || "http://localhost:8095";

export default defineConfig({
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
  projects: [
    {
      name: "unit",
      testDir: "./unit",
    },
    {
      name: "integration",
      testDir: "./integration",
    },
    {
      name: "e2e",
      testDir: "./e2e",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
