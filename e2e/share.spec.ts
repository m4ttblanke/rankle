import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/*
 * Spoiler-safe sharing (Milestone 5), exercised against the local Supabase
 * stack (see .env.test + playwright.config.ts), seeded by
 * `supabase/seed.sql` with a live "Fast Food Fries" game (today's game) and
 * an archived "Retro Snacks" game carrying a fixed, pre-seeded share token
 * (`deadbeefdeadbeefdeadbeefdeadbeef`) used for the old-link tests. Each test
 * gets a fresh browser context unless noted, so each run is its own distinct
 * guest identity.
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
const OLD_SHARE_TOKEN = "deadbeefdeadbeefdeadbeefdeadbeef";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const cardButton = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^${escapeRe(label)} — `) });

/** Rank every item and submit, starting from whatever URL the page is
 *  already on (so callers can start from `/` or `/?share=...`). */
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

async function withoutNativeShare(context: BrowserContext) {
  await context.addInitScript(() => {
    // Force the copy-link fallback deterministically, regardless of what the
    // running browser/OS actually supports.
    Object.defineProperty(window.navigator, "share", { value: undefined });
  });
}

async function grantClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
}

/** Submit today's game, share it (copy-link fallback), and return the copied
 *  share URL. */
async function createShareLink(page: Page, context: BrowserContext): Promise<string> {
  await withoutNativeShare(context);
  await grantClipboard(context);
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();

  await page.getByRole("button", { name: /^share your ranking$/i }).click();
  await expect(page.getByText(/^link copied$/i)).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/share\/[0-9a-f]{16,64}$/);
  return url;
}

test("sharing from /results copies a working link (no navigator.share)", async ({
  page,
  context,
}) => {
  const url = await createShareLink(page, context);
  expect(new URL(url).pathname).toMatch(/^\/share\/[0-9a-f]{16,64}$/);
});

test("navigator.share is used when available, with a spoiler-free message", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    (window as unknown as { __shareCalls: unknown[] }).__shareCalls = [];
    Object.defineProperty(window.navigator, "share", {
      value: (data: unknown) => {
        (window as unknown as { __shareCalls: unknown[] }).__shareCalls.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page.getByRole("heading", { name: /community verdict/i })).toBeVisible();

  await page.getByRole("button", { name: /^share your ranking$/i }).click();
  // Wait for the async share flow (createShare RPC -> navigator.share) to
  // finish rather than racing it: the button re-enables only once `share()`'s
  // promise chain resolves.
  await expect(page.getByRole("button", { name: /^share your ranking$/i })).toBeEnabled();
  const calls = await page.evaluate(
    () => (window as unknown as { __shareCalls: { text?: string; url?: string }[] }).__shareCalls,
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toMatch(/\/share\/[0-9a-f]{16,64}$/);
  expect(calls[0].text).toMatch(/play yours to reveal mine/i);
  // No spoiler content in the outbound text.
  expect(calls[0].text ?? "").not.toMatch(/consensus|controvers|hottest|tier/i);
});

test("cancelling the native share sheet (AbortError) is not shown as an error", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window.navigator, "share", {
      value: () => {
        const err = new Error("cancelled");
        err.name = "AbortError";
        return Promise.reject(err);
      },
    });
  });
  await page.goto("/");
  await rankAndSubmit(page);
  await page.getByRole("button", { name: /^share your ranking$/i }).click();
  await expect(page.getByRole("button", { name: /^share your ranking$/i })).toBeEnabled();
  await expect(page.getByText(/couldn.t create a share link/i)).toHaveCount(0);
});

test("a fresh recipient sees the locked, spoiler-free gate — no ranking data anywhere in the page", async ({
  page,
  context,
  browser,
}) => {
  const url = await createShareLink(page, context);

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(url);

  await expect(recipientPage.getByText(/think you agree/i)).toBeVisible();
  await expect(
    recipientPage.getByRole("link", { name: /play today.s rankle/i }),
  ).toBeVisible();

  // No tier letters, no "vs" comparison, no revealed-content headings anywhere
  // in the rendered HTML.
  const html = await recipientPage.content();
  expect(html).not.toMatch(/same placement on/i);
  expect(html).not.toMatch(/>S<|>A<|>B<|>C<|>F<|>N\/A</);

  await recipientContext.close();
});

test("the gate's CTA carries the token into today's game, and a fresh submission returns to /share/[token]", async ({
  page,
  context,
  browser,
}) => {
  const url = await createShareLink(page, context);
  const token = new URL(url).pathname.split("/").pop()!;

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(url);
  await recipientPage.getByRole("link", { name: /play today.s rankle/i }).click();
  await expect(recipientPage).toHaveURL(new RegExp(`/\\?share=${token}$`));

  await rankAndSubmit(recipientPage);
  await expect(recipientPage).toHaveURL(new RegExp(`/share/${token}/?$`));
  await expect(
    recipientPage.getByText(/same placement on \d+ of \d+ items/i),
  ).toBeVisible();

  await recipientContext.close();
});

test("a duplicate-submit outcome (already submitted today) also lands on /share/[token]", async ({
  page,
  context,
  browser,
}) => {
  const url = await createShareLink(page, context);
  const token = new URL(url).pathname.split("/").pop()!;

  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(`/?share=${token}`);
  await rankAndSubmit(recipientPage);
  await expect(recipientPage).toHaveURL(new RegExp(`/share/${token}/?$`));

  // Same identity (same context -> same guest cookie) revisits the
  // continuation URL after already submitting: the SERVER-side
  // already-submitted redirect in app/page.tsx must also honor the token.
  await recipientPage.goto(`/?share=${token}`);
  await expect(recipientPage).toHaveURL(new RegExp(`/share/${token}/?$`));

  await recipientContext.close();
});

test("ordinary gameplay without a share token still returns to /results", async ({ page }) => {
  await page.goto("/");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
});

test("a malformed share query is dropped, not carried into the redirect target", async ({
  page,
}) => {
  await page.goto("/?share=not-a-real-token!!!");
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
});

test("a share token for a non-current game cannot hijack today's post-submit destination", async ({
  page,
}) => {
  // The seeded old-game share points at "retro-snacks", not today's live
  // "fast-food-fries" game — the mismatch must be dropped before it reaches
  // the submission UI.
  await page.goto(`/?share=${OLD_SHARE_TOKEN}`);
  await rankAndSubmit(page);
  await expect(page).toHaveURL(/\/results\/?$/);
});

test("no open redirect: a URL-shaped share param never navigates off-origin", async ({
  page,
}) => {
  await page.goto("/?share=https%3A%2F%2Fevil.example.com");
  await rankAndSubmit(page);
  // Still same-origin, still the ordinary results page -- the malformed
  // token was rejected by shape before ever being used.
  expect(new URL(page.url()).origin).toBe("http://localhost:3000");
  await expect(page).toHaveURL(/\/results\/?$/);
});

test("an old, already-wrapped-up share shows a distinct 'wrapped up' state — never claims the game can still be played", async ({
  page,
}) => {
  await page.goto(`/share/${OLD_SHARE_TOKEN}`);
  await expect(page.getByText(/already wrapped up/i)).toBeVisible();
  const playToday = page.getByRole("link", { name: /play today.s rankle instead/i });
  await expect(playToday).toBeVisible();
  await expect(playToday).toHaveAttribute("href", "/");
  // Never implies this specific (old) game can still be played.
  await expect(page.getByRole("link", { name: /^play retro snacks$/i })).toHaveCount(0);
});

test("an invalid/malformed token renders a generic invalid-link state, not an error page", async ({
  page,
}) => {
  const response = await page.goto("/share/not-a-real-token-at-all");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByText(/this link doesn.t work/i)).toBeVisible();
});

test("mobile: the locked gate and the reveal both render without horizontal overflow", async ({
  page,
  context,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const url = await createShareLink(page, context);

  const recipientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(url);
  await expect(recipientPage.getByText(/think you agree/i)).toBeVisible();
  let overflow = await recipientPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await recipientPage.getByRole("link", { name: /play today.s rankle/i }).click();
  await rankAndSubmit(recipientPage);
  await expect(recipientPage.getByText(/same placement on/i)).toBeVisible();
  overflow = await recipientPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await recipientContext.close();
});
