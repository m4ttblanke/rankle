import { test, expect, type Page } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 430];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page has horizontal scroll").toBeLessThanOrEqual(0);
}

/*
 * `/` now talks to the local Supabase stack (Milestone 3; see .env.test +
 * playwright.config.ts), seeded by `supabase/seed.sql` with a live
 * "Fast Food Fries" game — so this suite exercises the real daily-game read
 * path instead of the empty state. The empty state itself (`NoGameToday`) is
 * covered as a component test (components/game/empty-state.test.tsx), since
 * nothing in this repo's local seed produces "no game published" on `/`.
 */
test.describe("/ (daily game)", () => {
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

    await page.goto("/");
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
      await page.goto("/");
      await expectNoHorizontalScroll(page);
    });
  }
});

test("unknown route renders the 404 page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: /page not found/i }),
  ).toBeVisible();
});
