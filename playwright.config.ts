import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load .env.test (local Supabase stack; see docs/DEPLOY.md) for the dev server
// this config launches, so e2e exercises real reads/writes against an isolated
// local database instead of production. Missing file falls back to the
// ambient environment untouched (e.g. `.env.local`, remote, read-only).
function loadEnvTest(file = ".env.test"): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * E2E config. Specs live in `e2e/`. The dev server is started automatically
 * (`next dev`) so the dev-only `/dev/preview` route is available for the
 * tier-board rendering checks; `/` and the submission flow talk to whatever
 * Supabase project `.env.test` (or the ambient environment) points at —
 * never write mutation-test data against production (docs/DEPLOY.md).
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
    env: {
      ...(process.env as Record<string, string>),
      ...loadEnvTest(),
    },
  },
});
