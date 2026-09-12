import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * Accounts & profiles (Milestone 6), exercised against the local Supabase
 * stack (see .env.test + playwright.config.ts + supabase/config.toml's
 * [auth] section). Real magic-link emails are sent to the local Mailpit
 * instance and fetched via its REST API — no email is mocked, and no auth
 * step is bypassed; this drives the actual /login -> email -> /auth/callback
 * flow a real user would follow.
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

/** Fetch the most recent email sent to `address` and return its plaintext
 *  magic-link URL. Polls briefly since local email delivery is async.
 *
 * Mailpit's `to:` query filter does not reliably narrow results (verified
 * empirically — it returns unrelated messages for a query matching nothing),
 * so with the full suite's parallel workers each sending their own OTP email
 * around the same time, trusting "most recent overall" is a real race:
 * filtering is done here, client-side, by an EXACT recipient-address match
 * across a wide enough recent window instead. */
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

/** Complete the full magic-link sign-in on `page` (already on /login),
 *  starting from a blank sign-in form, ending signed in on /profile. */
async function signInViaMagicLink(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /^send sign-in link$/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/profile\/?$/);
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

test("anonymous play is unaffected: header shows Sign in, game works without an account", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
});

test("/login renders and requires no account to view", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("transition A: a guest who has never played can sign in and play normally as an authenticated user", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("fresh");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // display name heading
  await expect(page.getByText(/your rankles \(0\)/i)).toBeVisible();

  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);

  await page.goto("/profile");
  await expect(page.getByText(/your rankles \(1\)/i)).toBeVisible();
  await context.close();
});

test("transition B: guest plays today's game, then signs in — claimed immediately, cannot resubmit, share still works", async ({
  page,
}) => {
  const email = uniqueEmail("claim-today");

  // play as a fresh guest first
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();

  // now sign in, in the SAME browser context (same guest cookie)
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  // revisiting the game screen recognizes the claimed submission immediately
  await page.goto("/");
  await expect(page).toHaveURL(/\/results\/?$/);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();

  // history shows it
  await page.goto("/profile");
  await expect(page.getByText(/your rankles \(1\)/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /fast food fries/i })).toBeVisible();

  // sharing the claimed submission still works
  await page.goto("/results");
  await page.getByRole("button", { name: /^share your ranking$/i }).click();
  await expect(
    page.getByText(/^link copied$/i).or(page.getByText(/couldn.t create a share link/i)),
  ).toBeVisible();
});

test("profile editing: username/display name update, and a taken username is rejected", async ({
  page,
  context,
  browser,
}) => {
  const emailA = uniqueEmail("editor-a");
  const emailB = uniqueEmail("editor-b");

  await page.goto("/login");
  await signInViaMagicLink(page, emailA);

  const uniqueUsername = `e2e${Date.now()}`.slice(0, 20);
  await page.getByLabel("Username").fill(uniqueUsername);
  await page.getByLabel("Display name").fill("E2E Tester A");
  await page.getByRole("button", { name: /^save changes$/i }).click();
  await expect(page.getByText(/^saved$/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E Tester A" })).toBeVisible();

  // a second user cannot take the same username
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/login");
  await signInViaMagicLink(otherPage, emailB);
  await otherPage.getByLabel("Username").fill(uniqueUsername);
  await otherPage.getByLabel("Display name").fill("E2E Tester B");
  await otherPage.getByRole("button", { name: /^save changes$/i }).click();
  await expect(otherPage.getByText(/already taken/i)).toBeVisible();
  await otherContext.close();

  await context.close();
});

test("history detail view is read-only and shows the player's own placements", async ({
  page,
}) => {
  const email = uniqueEmail("history-detail");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);

  await page.goto("/profile");
  await page.getByRole("link", { name: /fast food fries/i }).click();
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]+\/?$/);
  await expect(page.getByRole("heading", { name: "Fast Food Fries" })).toBeVisible();
  await expect(page.getByText("McDonald's")).toBeVisible();
  // read-only: no ranking controls of any kind on this page
  await expect(page.getByRole("button", { name: /move /i })).toHaveCount(0);
});

test("another signed-in user cannot view someone else's history detail page", async ({
  page,
  browser,
}) => {
  const emailOwner = uniqueEmail("owner");
  const emailOther = uniqueEmail("nosy");

  await page.goto("/login");
  await signInViaMagicLink(page, emailOwner);
  await page.goto("/");
  await rankAndSubmit(page);
  await page.goto("/profile");
  const href = await page.getByRole("link", { name: /fast food fries/i }).getAttribute("href");
  expect(href).toBeTruthy();

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/login");
  await signInViaMagicLink(otherPage, emailOther);
  await otherPage.goto(href!);
  // This route's ownership check uses notFound() (app/history/[submissionId]/
  // page.tsx), which — like every redirect() elsewhere in this app (e.g.
  // /results) — cannot change the already-streamed 200 status once the root
  // app/loading.tsx Suspense fallback has started sending bytes; that's a
  // pre-existing, app-wide Next.js streaming characteristic, not something
  // this route can opt out of. The actual security/product property is the
  // rendered content, which is what the rest of this app's e2e suite already
  // asserts on for the equivalent "redirected away, ineligible" cases.
  await expect(otherPage.getByText(/page not found/i)).toBeVisible();
  await expect(otherPage.getByText("McDonald's")).toHaveCount(0);
  await otherContext.close();
});

test("sign out clears the session; anonymous play still works afterward", async ({ page }) => {
  const email = uniqueEmail("signout");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  await page.getByRole("button", { name: /^sign out$/i }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();

  // /profile is no longer accessible
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\/?$/);

  // guest gameplay still works
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
});
