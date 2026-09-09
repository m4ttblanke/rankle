import { test, expect, type Page } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 430];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow, "page has horizontal scroll").toBeLessThanOrEqual(0);
}

test.describe("/ (daily game)", () => {
  test("renders the shell and the empty state (no game published)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("banner").getByText("Rankle", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /no game today/i }),
    ).toBeVisible();
    // Nothing spoiler-bearing rendered.
    await expect(page.getByText(/consensus|controvers|friends? played/i)).toHaveCount(
      0,
    );
  });

  for (const width of MOBILE_WIDTHS) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe("tier board (dev preview with sample data)", () => {
  test("shows the topic, line-up count, and every tier letter", async ({
    page,
  }) => {
    await page.goto("/dev/preview");
    await expect(
      page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
    ).toBeVisible();
    await expect(page.getByText(/line-up · 10 items/i)).toBeVisible();

    const lineup = page.getByRole("list", { name: /line-up/i });
    for (const label of [
      "McDonald's",
      "Five Guys",
      "In-N-Out",
      "Popeyes Cajun fries",
      "Culver's",
    ]) {
      await expect(lineup.getByText(label, { exact: true })).toBeVisible();
    }

    for (const letter of ["S", "A", "B", "C", "D"]) {
      await expect(
        page.getByText(`Tier ${letter}`, { exact: true }),
      ).toBeVisible();
    }
  });

  for (const width of MOBILE_WIDTHS) {
    test(`board has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dev/preview");
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
