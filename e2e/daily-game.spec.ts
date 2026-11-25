import { test, expect, type Page } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 430];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page has horizontal scroll").toBeLessThanOrEqual(0);
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

async function rankAndSubmit(page: Page) {
  for (let i = 0; i < ITEMS.length; i++) {
    const label = ITEMS[i];
    await page.getByRole("button", { name: new RegExp(`^${escapeRe(label)} — `) }).click();
    await page
      .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
      .getByRole("button", { name: new RegExp(`^tier ${TIERS[i % TIERS.length]}$`, "i") })
      .click();
  }
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(page).toHaveURL(/\/results\/?$/);
}

/** Result-only strings — field names from the `get_results` /
 *  `get_friend_results` payloads and the live friend-comparison label — that
 *  must never appear in the landing page's HTML or RSC payload. (Feature
 *  names like "Community verdict" legitimately appear in the how-it-works
 *  copy, so they are deliberately not part of this check.) */
const RESULT_ONLY = /agreement today|tierCounts|tier_counts|total_submissions|totalSubmissions|myRanking|my_ranking|submission_id|submissionId/;

/*
 * `/` is the public landing page; today's game lives at `/play`. Both talk to
 * the local Supabase stack (see .env.test + playwright.config.ts), seeded by
 * `supabase/seed.sql` with a live "Fast Food Fries" game. The no-game state of
 * each route is covered by `app/page.test.ts` / `app/play/page.test.ts` and
 * `components/game/empty-state.test.tsx`, since the seed always has a game.
 */
test.describe("/ (landing page)", () => {
  test("is a landing page, not the ranking board — today's topic is prominent and Play leads to /play", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: /everyone has a ranking/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Fast Food Fries" })).toBeVisible();

    // no board on the landing page
    await expect(page.getByRole("list", { name: /unranked items/i })).toHaveCount(0);
    await expect(page.locator("[data-card-id]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /submit ranking/i })).toHaveCount(0);

    const play = page.getByRole("link", { name: /play today.s rankle/i }).first();
    await expect(play).toHaveAttribute("href", "/play");
    await play.click();
    await expect(page).toHaveURL(/\/play\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Fast Food Fries" })).toBeVisible();
  });

  test("header: logo goes to /, Play goes to /play", async ({ page }) => {
    await page.goto("/play");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Rankle" })).toHaveAttribute("href", "/");
    await expect(banner.getByRole("link", { name: "Play" })).toHaveAttribute("href", "/play");
    await banner.getByRole("link", { name: "Rankle" }).click();
    await expect(page).toHaveURL(/localhost:3000\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /everyone has a ranking/i })).toBeVisible();
  });

  test("contains no real community or friend result data — in the DOM or the RSC payload — even once results exist", async ({
    page,
    browser,
  }) => {
    // Make sure real aggregate data exists for today's game.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/play");
    await rankAndSubmit(otherPage);
    await other.close();

    await page.goto("/");
    expect(await page.content()).not.toMatch(RESULT_ONLY);
    const rsc = await (await page.request.get("/", { headers: { RSC: "1" } })).text();
    expect(rsc).not.toMatch(RESULT_ONLY);

    // Every results-style visual on the page is a labelled, fictional example.
    const figures = page.locator("figure");
    expect(await figures.count()).toBeGreaterThanOrEqual(3);
    for (const fig of await figures.all()) {
      await expect(fig.getByText(/^example/i)).toBeVisible();
    }
    // The demo topic, never today's items, appears in the demos.
    await expect(figures.getByText(/mcdonald|five guys|in-n-out/i)).toHaveCount(0);
  });

  test("an identity that already submitted sees See Today's Results -> /results, not Play", async ({
    page,
  }) => {
    await page.goto("/play");
    await rankAndSubmit(page);

    await page.goto("/");
    const results = page.getByRole("link", { name: /see today.s results/i });
    await expect(results.first()).toHaveAttribute("href", "/results");
    await expect(page.getByRole("main").getByRole("link", { name: /play today.s rankle|make your ranking/i })).toHaveCount(0);
    await results.first().click();
    await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();
  });

  test("has spoiler-safe, topic-free metadata", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/rankle/i);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toMatch(/tier list every day/i);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toMatch(/rankle/i);
    expect(`${description} ${ogTitle}`).not.toMatch(/fast food fries/i);
  });

  test("reduced motion: cards stay still and the CTA still works", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const iterations = await page
      .locator(".rankle-bob, .rankle-drop")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationIterationCount));
    expect(iterations.length).toBeGreaterThan(0);
    expect(new Set(iterations)).toEqual(new Set(["1"]));
    await page.getByRole("link", { name: /play today.s rankle/i }).first().click();
    await expect(page).toHaveURL(/\/play\/?$/);
  });

  for (const width of MOBILE_WIDTHS) {
    test(`no horizontal scroll at ${width}px, CTA visible above the fold`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expectNoHorizontalScroll(page);
      await expect(page.getByRole("link", { name: /play today.s rankle/i }).first()).toBeInViewport();
    });
  }
});

test.describe("/play (daily game)", () => {
  test("renders the shell and today's live game, pre-submission and spoiler-free", async ({
    page,
  }) => {
    const spoilerBearingCalls: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (/get_results|get_share|has_submitted_ranking/.test(u)) {
        spoilerBearingCalls.push(u);
      }
    });

    await page.goto("/play");
    await expect(
      page.getByRole("banner").getByText("Rankle", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: /unranked items/i }),
    ).toBeVisible();

    // no community/friend/results data, and no results/spoiler RPC calls
    // (has_submitted_ranking is only called when a guest cookie already
    // exists, which a first visit never has)
    await expect(
      page.getByText(/consensus|controvers|friends? played|hottest take/i),
    ).toHaveCount(0);
    expect(spoilerBearingCalls).toEqual([]);
  });

  for (const width of MOBILE_WIDTHS) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/play");
      await expectNoHorizontalScroll(page);
    });
  }
});

test("unknown route renders the 404 page, which points back into the game", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: /page not found/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /today.s game/i })).toHaveAttribute("href", "/play");
});
