import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Specs live in `e2e/`. The dev server is started automatically
 * (`next dev`) so the dev-only `/dev/preview` route is available for the
 * tier-board rendering checks; `/` talks to the remote Supabase project
 * read-only (no game published yet, so it shows the empty state).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
