import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * Session-persistence audit (docs/TODO.md "Accounts" — reduce
 * re-authentication friction). Exercised against the local Supabase stack,
 * same as e2e/accounts.spec.ts. No auth step is mocked.
 *
 * These tests establish, with real cookies, three separate claims:
 *   1. The Supabase auth cookie Set by this app is a genuinely persistent
 *      cookie (a long `expires`), not a browser-session-scoped cookie — the
 *      thing that would make a browser restart silently sign someone out.
 *   2. Ordinary navigation (reload, new tab in the same context) preserves
 *      the signed-in state.
 *   3. Explicit sign-out revokes the session server-side (Supabase
 *      `scope: 'global'`), not merely clearing the local cookie — replaying
 *      the pre-sign-out cookie value in a fresh context must NOT regain
 *      access. This is the sign-out invariant from docs/SECURITY.md sec 17.
 *
 * What this file does NOT claim to test: an actual OS-level browser
 * restart, or a real multi-day wait. Playwright has no faithful way to
 * simulate either — reusing a `storageState` in a fresh `BrowserContext` is
 * the closest available proxy (it round-trips the same cookie jar through a
 * brand-new context/process boundary), but it is not proof of literal
 * browser-restart behavior. The 400-day `expires` assertion below is the
 * actual evidence that a real restart would preserve the session, since a
 * persistent cookie survives a restart by definition while a session cookie
 * would not.
 */

function loadEnvTest(file = ".env.test"): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through to defaults below
  }
  return out;
}

const MAILPIT_URL = loadEnvTest().MAILPIT_URL ?? "http://127.0.0.1:54324";

async function getLatestMagicLink(address: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=100`);
    const list = (await listRes.json()) as {
      messages: { ID: string; To: { Address: string }[]; Created: string }[];
    };
    const matches = list.messages
      .filter((m) => m.To.some((t) => t.Address === address))
      .sort((a, b) => b.Created.localeCompare(a.Created));
    if (matches.length > 0) {
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${matches[0].ID}`);
      const msg = (await msgRes.json()) as { Text: string };
      const match = msg.Text.match(/\(\s*(http[^\s)]+)\s*\)/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No magic-link email found for ${address}`);
}

function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rankle.test`;
}

async function signInViaMagicLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /^send sign-in link$/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/profile\/?$/);
}

test("the Supabase auth cookie is persistent, not browser-session-scoped", async ({
  page,
  context,
}) => {
  await signInViaMagicLink(page, uniqueEmail("cookie-lifetime"));

  const authCookies = (await context.cookies()).filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );
  expect(authCookies.length).toBeGreaterThan(0);

  const nowSeconds = Date.now() / 1000;
  const minAcceptableExpiry = nowSeconds + 300 * 24 * 60 * 60; // 300 days out
  for (const cookie of authCookies) {
    // -1 (or unset) is a browser-session cookie, which would sign the user
    // out on browser restart — the opposite of what "return tomorrow" needs.
    expect(cookie.expires).toBeGreaterThan(minAcceptableExpiry);
  }
});

test("refresh preserves authentication", async ({ page }) => {
  await signInViaMagicLink(page, uniqueEmail("refresh"));
  await page.reload();
  await expect(page).toHaveURL(/\/profile\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a new tab in the same browser context preserves authentication", async ({
  page,
  context,
}) => {
  await signInViaMagicLink(page, uniqueEmail("new-tab"));

  const secondTab = await context.newPage();
  await secondTab.goto("/profile");
  await expect(secondTab).toHaveURL(/\/profile\/?$/);
  await expect(secondTab.getByRole("heading", { level: 1 })).toBeVisible();
  await secondTab.close();
});

test("a fresh context loaded with the same persisted cookies stays authenticated (closest available proxy for a browser restart)", async ({
  page,
  context,
  browser,
}) => {
  await signInViaMagicLink(page, uniqueEmail("restart-proxy"));
  const storageState = await context.storageState();

  const restartedContext = await browser.newContext({ storageState });
  const restartedPage = await restartedContext.newPage();
  await restartedPage.goto("/profile");
  await expect(restartedPage).toHaveURL(/\/profile\/?$/);
  await expect(restartedPage.getByRole("heading", { level: 1 })).toBeVisible();
  await restartedContext.close();
});

test("explicit sign-out revokes the session server-side, not just the local cookie", async ({
  page,
  context,
  browser,
}) => {
  await signInViaMagicLink(page, uniqueEmail("revoke"));

  // Capture the authenticated cookie jar BEFORE signing out.
  const preSignOutState = await context.storageState();

  await page.getByRole("button", { name: /^sign out$/i }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // Replay the pre-sign-out cookies in a brand-new context. If sign-out only
  // cleared the local cookie (rather than revoking the refresh token
  // server-side via Supabase's default `scope: 'global'`), this stolen/stale
  // cookie would still grant access — a real session-fixation-style gap.
  const replayContext = await browser.newContext({ storageState: preSignOutState });
  const replayPage = await replayContext.newPage();
  await replayPage.goto("/profile");
  await expect(replayPage).toHaveURL(/\/login\/?$/);
  await replayContext.close();
});
