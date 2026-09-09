import { test, expect, type Page } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 430];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page has horizontal scroll").toBeLessThanOrEqual(0);
}

test.describe("/ (daily game)", () => {
  test("renders the shell and the empty state (no game published)", async ({
    page,
  }) => {
    const supabaseCalls: string[] = [];
    page.on("request", (r) => {
      if (/\/rest\/v1\/rpc\//.test(r.url())) supabaseCalls.push(r.url());
    });

    await page.goto("/");
    await expect(
      page.getByRole("banner").getByText("Rankle", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /no game today/i }),
    ).toBeVisible();

    // no spoiler-bearing data, and no results/share RPC calls
    await expect(
      page.getByText(/consensus|controvers|friends? played|hottest take/i),
    ).toHaveCount(0);
    expect(supabaseCalls).toEqual([]);
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
