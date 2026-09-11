import { test, expect, type Page } from "@playwright/test";

/*
 * Official submission (Milestone 3), exercised on `/` against the local
 * Supabase stack (see .env.test + playwright.config.ts), seeded by
 * `supabase/seed.sql` with a live "Fast Food Fries" game. Each test gets a
 * fresh browser context, so each run submits as its own distinct guest
 * identity — no cross-test collisions with the one-submission-per-guest
 * database constraint.
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

async function rankEveryItem(page: Page) {
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
  await expect(page.getByText(/all 10 ranked/i)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
  ).toBeVisible();
});

test("rank all items -> submit -> confirm -> locked state", async ({ page }) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await expect(page.getByText(/can.t be undone|locks your ranking/i)).toBeVisible();
  await page.getByRole("button", { name: /^lock it in$/i }).click();

  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
  await expect(page.getByRole("list")).toHaveCount(0);
});

test("rapid double activation of Lock it in sends exactly one submission", async ({
  page,
}) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();

  let submitPosts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) submitPosts += 1;
  });

  await page.getByRole("button", { name: /^lock it in$/i }).dblclick();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
  expect(submitPosts).toBe(1);
});

test("a failed submission preserves the ranking and allows retry", async ({
  page,
}) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();

  // Fail the Server Action's POST exactly once, then let it through.
  let intercepted = false;
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      if (route.request().method() === "POST" && !intercepted) {
        intercepted = true;
        await route.abort("failed");
      } else {
        await route.continue();
      }
    },
  );

  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  // ranking is untouched — every item is still placed
  for (const label of ITEMS) {
    await expect(cardButton(page, label)).toBeVisible();
  }

  await page.getByRole("button", { name: /^try again$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
});

test("refresh after a successful submission recognises the locked state", async ({
  page,
}) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: /you.re locked in/i }),
  ).toBeVisible();
  // no ranking controls at all after refresh
  await expect(page.getByRole("list")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /submit/i })).toHaveCount(0);
});

test("the ranking cannot be changed after a successful submission", async ({
  page,
}) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();

  // no draggable/selectable cards remain in the document at all
  await expect(page.locator("[data-card-id]")).toHaveCount(0);
});

test("no results, community, or friend data appears before or after submission", async ({
  page,
}) => {
  const forbidden = /consensus|controvers|hottest take|friends? played|% agree/i;
  await expect(page.getByText(forbidden)).toHaveCount(0);

  await rankEveryItem(page);
  await expect(page.getByText(forbidden)).toHaveCount(0);

  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
  await expect(page.getByText(forbidden)).toHaveCount(0);
});

test("keyboard-only submission flow", async ({ page }) => {
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^lock it in$/i })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
});

test("mobile submission flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await rankEveryItem(page);
  await page.getByRole("button", { name: /^submit ranking$/i }).click();
  await page.getByRole("button", { name: /^lock it in$/i }).click();
  await expect(
    page.getByRole("heading", { name: /ranking locked in/i }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const width of [320, 375, 390, 430, 768, 1280]) {
  test(`no horizontal overflow at ${width}px with the submit control visible`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await cardButton(page, "McDonald's").click();
    await page
      .getByRole("group", { name: /move mcdonald/i })
      .getByRole("button", { name: /^tier S$/i })
      .click();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  });
}
