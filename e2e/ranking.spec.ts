import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * Interactive ranking board (Milestone 2), exercised on the dev-only
 * `/dev/preview` route with sample data ("Fast Food Fries", 10 items, tiers
 * S/A/B/C/D). That route fetches nothing — server or client — so it is also the
 * clean place to prove the pre-submission data boundary.
 */

const SAMPLE_ITEMS = [
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

const laneList = (page: Page, name: RegExp) =>
  page.getByRole("list", { name });

async function labelsIn(lane: Locator): Promise<string[]> {
  const names = await lane
    .getByRole("button", { name: / — / })
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")!.split(" — ")[0]),
    );
  return names;
}

const cardButton = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^${escapeRe(label)} — `) });

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A dnd-kit-compatible pointer drag (needs several intermediate mousemoves
 *  and a beat between them for the sensor to activate and track). */
async function dragCardToLane(page: Page, cardLabel: string, laneName: RegExp) {
  const card = cardButton(page, cardLabel);
  const lane = laneList(page, laneName);

  // neutral position + settle so a previous drag's listeners are fully torn down
  await page.mouse.move(2, 2);
  await page.waitForTimeout(150);

  await card.scrollIntoViewIfNeeded();
  const cb = await card.boundingBox();
  if (!cb) throw new Error("missing card box");
  const sx = cb.x + cb.width / 2;
  const sy = cb.y + cb.height / 2;

  await page.mouse.move(sx, sy, { steps: 4 });
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(sx + 4, sy - 6, { steps: 3 });
  await page.mouse.move(sx + 6, sy + 24, { steps: 8 }); // clearly exceed 8px -> activate
  await page.waitForTimeout(60);

  await lane.scrollIntoViewIfNeeded();
  const lb = await lane.boundingBox();
  if (!lb) throw new Error("missing lane box");
  const tx = lb.x + lb.width / 2;
  const ty = lb.y + Math.min(lb.height * 0.6, lb.height - 6);

  await page.mouse.move(tx, ty, { steps: 24 });
  await page.waitForTimeout(60);
  await page.mouse.move(tx + 2, ty, { steps: 4 }); // nudge -> onDragOver settles
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/preview");
  await expect(
    page.getByRole("heading", { level: 1, name: "Fast Food Fries" }),
  ).toBeVisible();
});

test("starts with every item in Unranked and a remaining count", async ({
  page,
}) => {
  expect(await labelsIn(laneList(page, /unranked items/i))).toEqual(SAMPLE_ITEMS);
  for (const t of ["S", "A", "B", "C", "D"]) {
    expect(await labelsIn(laneList(page, new RegExp(`tier ${t}`, "i")))).toEqual(
      [],
    );
  }
  await expect(page.getByRole("heading", { name: /unranked . 10/i })).toBeVisible();
});

test("tap/click picker: pool -> tier -> tier -> pool", async ({ page }) => {
  await cardButton(page, "In-N-Out").click();
  await page
    .getByRole("group", { name: /move in-n-out/i })
    .getByRole("button", { name: /^tier A$/i })
    .click();
  await expect
    .poll(() => labelsIn(laneList(page, /tier A/i)))
    .toEqual(["In-N-Out"]);

  await cardButton(page, "In-N-Out").click();
  await page
    .getByRole("group", { name: /move in-n-out/i })
    .getByRole("button", { name: /^tier S$/i })
    .click();
  await expect
    .poll(() => labelsIn(laneList(page, /tier S/i)))
    .toEqual(["In-N-Out"]);
  expect(await labelsIn(laneList(page, /tier A/i))).toEqual([]);

  await cardButton(page, "In-N-Out").click();
  await page
    .getByRole("group", { name: /move in-n-out/i })
    .getByRole("button", { name: /^unranked$/i })
    .click();
  await expect
    .poll(() => labelsIn(laneList(page, /unranked items/i)))
    .toContain("In-N-Out");
  await expect(page.getByRole("heading", { name: /unranked . 10/i })).toBeVisible();
});

test("desktop drag: pool -> tier, then tier -> tier", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/preview");

  await dragCardToLane(page, "Five Guys", /tier S/i);
  await expect
    .poll(() => labelsIn(laneList(page, /tier S/i)))
    .toContain("Five Guys");
  await expect(page.getByRole("heading", { name: /unranked . 9/i })).toBeVisible();

  await dragCardToLane(page, "Five Guys", /tier C/i);
  await expect
    .poll(() => labelsIn(laneList(page, /tier C/i)))
    .toContain("Five Guys");
  expect(await labelsIn(laneList(page, /tier S/i))).not.toContain("Five Guys");
});

test("keyboard only: Tab to a card, Enter, Enter on a tier", async ({ page }) => {
  await page.keyboard.press("Tab"); // first card
  await expect(cardButton(page, "McDonald's")).toBeFocused();
  await page.keyboard.press("Enter");
  const tierS = page
    .getByRole("group", { name: /move mcdonald/i })
    .getByRole("button", { name: /^tier S$/i });
  await expect(tierS).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => labelsIn(laneList(page, /tier S/i)))
    .toEqual(["McDonald's"]);
  await expect(cardButton(page, "McDonald's")).toBeFocused();
});

test("reorder within a tier via the card controls", async ({ page }) => {
  for (const label of ["McDonald's", "Five Guys", "In-N-Out"]) {
    await cardButton(page, label).click();
    await page
      .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
      .getByRole("button", { name: /^tier B$/i })
      .click();
  }
  expect(await labelsIn(laneList(page, /tier B/i))).toEqual([
    "McDonald's",
    "Five Guys",
    "In-N-Out",
  ]);
  await cardButton(page, "In-N-Out").click();
  await page.getByRole("button", { name: /move In-N-Out up/i }).click();
  await expect
    .poll(() => labelsIn(laneList(page, /tier B/i)))
    .toEqual(["McDonald's", "In-N-Out", "Five Guys"]);
});

test("ranking every item shows the completion state and no submit button", async ({
  page,
}) => {
  const tiers = ["S", "A", "B", "C", "D"];
  for (let i = 0; i < SAMPLE_ITEMS.length; i++) {
    const label = SAMPLE_ITEMS[i];
    await cardButton(page, label).click();
    await page
      .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
      .getByRole("button", { name: new RegExp(`^tier ${tiers[i % 5]}$`, "i") })
      .click();
  }
  await expect(page.getByText(/all 10 ranked/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /unranked · 0/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /submit/i })).toHaveCount(0);
});

test("no network / no spoiler data while ranking", async ({ page }) => {
  const flagged: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (
      /supabase\.co/.test(u) ||
      /\/rest\/v1\//.test(u) ||
      /submit_ranking|get_results|create_share|get_share/.test(u)
    ) {
      flagged.push(u);
    }
  });

  for (const label of ["McDonald's", "Five Guys", "In-N-Out"]) {
    await cardButton(page, label).click();
    await page
      .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
      .getByRole("button", { name: /^tier S$/i })
      .click();
  }

  expect(flagged).toEqual([]);
  const html = await page.content();
  expect(html).not.toMatch(
    /consensus|controvers|hottest take|friends? played|% agree/i,
  );
});

test("reduced motion: ranking still works end to end", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/preview");
  await cardButton(page, "Wendy's").click();
  await page
    .getByRole("group", { name: /move wendy/i })
    .getByRole("button", { name: /^tier D$/i })
    .click();
  await expect
    .poll(() => labelsIn(laneList(page, /tier D/i)))
    .toEqual(["Wendy's"]);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

  test("cards allow vertical panning and a quick swipe does not drag", async ({
    page,
  }) => {
    await page.goto("/dev/preview");

    // 1. the browser is allowed to scroll vertically over a card
    const touchAction = await cardButton(page, "McDonald's").evaluate(
      (el) => getComputedStyle(el).touchAction,
    );
    expect(touchAction).toMatch(/pan-y/);

    // 2. a fast synthetic swipe (exceeds tolerance before the press delay) must
    //    not start a drag -> nothing gets ranked
    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>("[data-card-id]")!;
      const r = card.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y0 = r.y + r.height / 2;
      const touch = (type: string, y: number) => {
        const t = new Touch({
          identifier: 1,
          target: card,
          clientX: x,
          clientY: y,
        });
        const list = type === "touchend" ? [] : [t];
        card.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: list,
            targetTouches: list,
            changedTouches: [t],
          }),
        );
      };
      touch("touchstart", y0);
      touch("touchmove", y0 - 50);
      touch("touchend", y0 - 50);
    });

    for (const t of ["S", "A", "B", "C", "D"]) {
      expect(
        await labelsIn(laneList(page, new RegExp(`tier ${t}`, "i"))),
      ).toEqual([]);
    }
    await expect(page.getByRole("heading", { name: /unranked . 10/i })).toBeVisible();
  });
});

for (const width of [320, 375, 390, 430, 768, 1280]) {
  test(`no horizontal scroll at ${width}px with items across tiers`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/preview");
    // distribute a few items so lanes are populated
    for (const [label, tier] of [
      ["McDonald's", "S"],
      ["Five Guys", "S"],
      ["In-N-Out", "A"],
      ["Chick-fil-A waffle fries", "B"],
    ] as const) {
      await cardButton(page, label).click();
      await page
        .getByRole("group", { name: new RegExp(`move ${escapeRe(label)}`, "i") })
        .getByRole("button", { name: new RegExp(`^tier ${tier}$`, "i") })
        .click();
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  });
}
