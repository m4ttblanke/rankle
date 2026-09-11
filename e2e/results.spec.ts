import { test, expect, type Page } from "@playwright/test";

/*
 * Community results reveal (Milestone 4), exercised against the local
 * Supabase stack (see .env.test + playwright.config.ts), seeded by
 * `supabase/seed.sql` with a live "Fast Food Fries" game (6 items cycle
 * S/A/B/C/F/N/A across the 10 seeded items, so every submission here already
 * exercises an N/A placement). Each test gets a fresh browser context, so
 * each run is its own distinct guest identity.
 *
 * Exact consensus/controversy/hottest-take VALUES and every low-data-state
 * branch are covered at the unit level (`lib/game/results.test.ts`) against
 * controlled fixtures — the total submission count for this seeded game
 * varies with what other specs/workers have already submitted, so asserting
 * precise wording here would be flaky by construction. This file instead
 * proves the app-level wiring: the spoiler gate holds, the reveal renders,
 * N/A reads as neutral, and the page is usable on mobile/keyboard.
 */

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

async function submitFullRanking(page: Page) {
  await page.goto("/");
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

test("a fresh identity hitting /results directly is redirected, with no spoiler content", async ({
  page,
}) => {
  const forbidden = /consensus|controvers|hottest take|community verdict/i;
  await page.goto("/results");
  await expect(page).toHaveURL("http://localhost:3000/"); // redirected away from /results
  await expect(page.getByText(forbidden)).toHaveCount(0);
  // the daily game screen, not any part of the reveal
  await expect(
    page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
  ).toBeVisible();
});

test("one identity's submission does not unlock another identity's results", async ({
  page,
  browser,
}) => {
  await submitFullRanking(page);
  await expect(
    page.getByRole("heading", { name: /community verdict/i }),
  ).toBeVisible();

  // A second, independent identity (fresh browser context = fresh cookies)
  // has not submitted anything for this game.
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/results");
  await expect(otherPage).toHaveURL("http://localhost:3000/");
  await expect(
    otherPage.getByText(/consensus|controvers|hottest take|community verdict/i),
  ).toHaveCount(0);
  await otherContext.close();
});

test("after submitting, the results reveal renders: verdict, comparison, hottest take", async ({
  page,
}) => {
  await submitFullRanking(page);

  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your ranking vs\. everyone else/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /your hottest take/i })).toBeVisible();

  // The reveal's own heading receives focus (no full page reload happened —
  // this was a client-side `router.replace`, so focus must be moved manually).
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("N/A reads as neutral, not as a sixth tier worse than F", async ({ page }) => {
  await submitFullRanking(page);

  // The community tier list has exactly one row per SCORED tier (S/A/B/C/F) —
  // "N/A" is never one of the community-verdict row labels.
  await expect(
    page.getByRole("list", { name: /^community tier n\/a$/i }),
  ).toHaveCount(0);

  // Our own N/A placement (every 6th item in the cycle) shows up under its own
  // neutral "Haven't tried" heading in the comparison list, not sorted in as
  // if it were simply the worst tier.
  await expect(page.getByText(/haven.t tried/i).first()).toBeVisible();
});

test("mobile: results page has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitFullRanking(page);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const width of [320, 375, 430, 768, 1280]) {
  test(`no horizontal overflow at ${width}px on the results page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await submitFullRanking(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  });
}
