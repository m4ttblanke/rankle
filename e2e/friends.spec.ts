import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * Friends (Milestone 7), exercised against the local Supabase stack with two
 * REAL signed-in users driving the full magic-link flow — same discipline as
 * e2e/accounts.spec.ts (no auth step mocked, real Mailpit email delivery).
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
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /^send sign-in link$/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/profile\/?$/);
}

/** Read the signed-in user's own username off their (already-loaded) /profile
 *  page — `@username · Joined ...`. */
async function currentUsername(page: Page): Promise<string> {
  const text = await page.locator("text=/^@/").first().innerText();
  const match = text.match(/^@([a-z0-9_]+)/);
  if (!match) throw new Error(`could not parse username from "${text}"`);
  return match[1];
}

const ITEMS = [
  "McDonald's",
  "Five Guys",
  "In-N-Out",
  "Wendy's",
  "Burger King",
  "Chick-fil-A waffle fries",
  "Arby's curly fries",
  "Shake Shack crinkle-cut",
  "Popeyes Cajun fries",
  "Culver's",
];
const TIERS = ["S", "A", "B", "C", "F", "N/A"];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const cardButton = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^${escapeRe(label)} — `) });

async function rankAndSubmit(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
  ).toBeVisible();
  for (let i = 0; i < ITEMS.length; i++) {
    const label = ITEMS[i];
    await cardButton(page, label).click();
    await page
      .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
      .getByRole("button", {
        name: new RegExp(`^tier ${TIERS[i % TIERS.length]}$`, "i"),
      })
      .click();
  }
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
}

test("anonymous visitors see no Friends nav link and are unaffected", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /^friends$/i })).toHaveCount(0);
  await page.goto("/friends");
  await expect(page).toHaveURL(/\/login\/?$/);
});

test("full loop: search, request, accept, both play, see comparison, then unfriend hides it", async ({
  page,
  browser,
}) => {
  const emailA = uniqueEmail("friends-a");
  const emailB = uniqueEmail("friends-b");

  // A signs in
  await page.goto("/login");
  await signInViaMagicLink(page, emailA);

  // B signs in, in a separate browser context
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto("/login");
  await signInViaMagicLink(pageB, emailB);
  const usernameB = await currentUsername(pageB);

  // A finds B by username and sends a request
  await page.goto("/friends");
  await page.getByLabel(/search by username/i).fill(usernameB);
  await expect(page.getByRole("button", { name: /^add$/i })).toBeVisible();
  await page.getByRole("button", { name: /^add$/i }).click();
  await expect(page.getByRole("button", { name: /^requested$/i })).toBeVisible();

  // B sees the incoming request and accepts it
  await pageB.goto("/friends");
  await expect(pageB.getByRole("heading", { name: /^requests/i })).toBeVisible();
  await pageB.getByRole("button", { name: /^accept$/i }).click();
  await expect(pageB.getByRole("button", { name: /^accept$/i })).toHaveCount(0);
  await expect(pageB.getByRole("heading", { name: /^your friends \(1\)/i })).toBeVisible();

  // A also sees the friendship now
  await page.goto("/friends");
  await expect(page.getByRole("heading", { name: /^your friends \(1\)/i })).toBeVisible();

  // both play and submit today's game
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);

  await pageB.goto("/");
  await rankAndSubmit(pageB);
  await expect(pageB).toHaveURL(/\/results\/?$/);

  // A's results page now shows a Friends section with B's comparison
  await page.goto("/results");
  await expect(page.getByRole("heading", { name: /^friends$/i })).toBeVisible();
  await expect(page.getByText(/same placement on \d+ of \d+/i)).toBeVisible();

  // unfriending hides the comparison immediately
  await page.goto("/friends");
  await page.getByRole("button", { name: /^remove$/i }).click();
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page.getByText(/no friends yet/i)).toBeVisible();

  await page.goto("/results");
  await expect(page.getByRole("heading", { name: /^friends$/i })).toBeVisible();
  await expect(page.getByText(/no friends have played/i)).toBeVisible();

  await contextB.close();
});

test("cannot friend yourself; search excludes your own account", async ({ page }) => {
  const email = uniqueEmail("friends-self");
  await page.goto("/login");
  await signInViaMagicLink(page, email);
  const username = await currentUsername(page);

  await page.goto("/friends");
  await page.getByLabel(/search by username/i).fill(username);
  await expect(page.getByText(/no matching users/i)).toBeVisible();
});

test("a failed remove (session lost mid-page) shows a visible error and never falsely removes the friend", async ({
  page,
  browser,
}) => {
  const emailA = uniqueEmail("friends-remove-fail-a");
  const emailB = uniqueEmail("friends-remove-fail-b");

  await page.goto("/login");
  await signInViaMagicLink(page, emailA);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto("/login");
  await signInViaMagicLink(pageB, emailB);
  const usernameB = await currentUsername(pageB);

  await page.goto("/friends");
  await page.getByLabel(/search by username/i).fill(usernameB);
  await page.getByRole("button", { name: /^add$/i }).click();

  await pageB.goto("/friends");
  await pageB.getByRole("button", { name: /^accept$/i }).click();
  await expect(pageB.getByRole("heading", { name: /^your friends \(1\)/i })).toBeVisible();

  await page.goto("/friends");
  await expect(page.getByRole("heading", { name: /^your friends \(1\)/i })).toBeVisible();

  // Simulate a session that expired while the tab stayed open (a real,
  // reachable failure — `removeFriend` returns `{ ok: false, reason:
  // "unauthenticated" }` server-side, not a mocked/injected fault) rather
  // than an unreachable RPC-level error most of these RPCs are idempotent
  // against.
  await page.context().clearCookies();
  await page.getByRole("button", { name: /^remove$/i }).click();
  await page.getByRole("button", { name: /^confirm$/i }).click();

  // visible, not sr-only: getByRole("alert") only matches an in-flow,
  // rendered element, and toBeVisible() additionally requires it to have
  // layout (not display:none/sr-only-clipped). Scoped by text since Next's
  // own route announcer also carries role="alert" (empty, off-screen).
  const removeError = page.getByRole("alert").filter({ hasText: /couldn.t remove/i });
  await expect(removeError).toBeVisible();
  await expect(page.getByRole("heading", { name: /^your friends \(1\)/i })).toBeVisible();

  await contextB.close();
});

test("community results and sharing are unaffected by the Friends feature", async ({ page }) => {
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();
  // guests never see a Friends section (account-only feature)
  await expect(page.getByRole("heading", { name: /^friends$/i })).toHaveCount(0);

  await page.getByRole("button", { name: /^share your ranking$/i }).click();
  await expect(
    page.getByText(/^link copied$/i).or(page.getByText(/couldn.t create a share link/i)),
  ).toBeVisible();
});
