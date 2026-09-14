import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * Retention polish (Milestone 9): the post-submit "come back tomorrow" cue
 * (countdown + streak) and the profile streak stats. Exercised against the
 * local Supabase stack's real seed data — `supabase/seed.sql` schedules
 * "Pixar Movies" for tomorrow, which is exactly the fixture
 * `get_next_release_date()`/`computeCountdown` need to resolve the
 * "tomorrow" countdown case deterministically, with no invented fixture.
 * Multi-day streak history (2+ consecutive Rankles) would require backdating
 * submissions, which isn't reachable through the UI/seed — out of scope here
 * per the M9 brief; `lib/game/streaks.test.ts` covers that math directly.
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
  await expect(page).toHaveURL(/\/results\/?$/);
}

test("return cue renders on /results with the countdown, without breaking the rest of the reveal (guest, no streak claim)", async ({
  page,
}) => {
  await page.goto("/");
  await rankAndSubmit(page);

  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^come back tomorrow$/i }),
  ).toBeVisible();
  // guest: no streak claim, only the countdown
  await expect(page.getByText(/rankles? in a row/i)).toHaveCount(0);
  await expect(page.getByText(/next rankle (tomorrow\.|in )/i)).toBeVisible();
});

test("an authenticated player's first submission shows a 1-Rankle streak on /results and /profile", async ({
  page,
}) => {
  const email = uniqueEmail("retention-streak");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page.getByText(/^1 rankle in a row$/i)).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: /^streak$/i })).toBeVisible();
  const stats = page.getByRole("definition"); // <dd> current/longest/total
  await expect(stats).toHaveText(["1", "1", "1"]);
});

test("no horizontal overflow on /results or /profile at mobile widths after the M9 return cue/streak additions", async ({
  page,
}) => {
  const email = uniqueEmail("retention-mobile");
  await page.goto("/login");
  await signInViaMagicLink(page, email);
  await page.goto("/");
  await rankAndSubmit(page);

  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/results", "/profile"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow on ${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test("the new M9 route boundaries (loading/error scaffolding) don't themselves break normal navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  const email = uniqueEmail("retention-nav");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  for (const path of ["/", "/archive", "/friends", "/profile"]) {
    await page.goto(path);
    await expect(page.getByRole("banner")).toBeVisible();
  }

  expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
});
