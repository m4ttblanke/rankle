import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/*
 * Archive browse (Milestone 9), exercised against the local Supabase stack.
 * `supabase/seed.sql` gives us real fixtures for every visibility case
 * without inventing any new ones: "Retro Snacks" (archived, released
 * yesterday), "Fast Food Fries" (live, released today), "Pixar Movies"
 * (scheduled, released tomorrow — must NOT appear), and "Breakfast Foods"
 * (draft, no release date — must NOT appear).
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

test("anonymous visitor sees past/live Rankles but never future-scheduled or draft ones", async ({
  page,
}) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { level: 1, name: "Archive" })).toBeVisible();

  await expect(page.getByText("Retro Snacks")).toBeVisible();
  await expect(page.getByText("Fast Food Fries")).toBeVisible();
  await expect(page.getByText("Pixar Movies")).toHaveCount(0);
  await expect(page.getByText("Breakfast Foods")).toHaveCount(0);
});

test("guest archive never fabricates a played indicator", async ({ page }) => {
  await page.goto("/archive");
  const retroRow = page.locator("li").filter({ hasText: "Retro Snacks" });
  await expect(retroRow.getByText(/played/i)).toHaveCount(0);

  const liveRow = page.locator("li").filter({ hasText: "Fast Food Fries" });
  await expect(liveRow.getByText(/^today$/i)).toBeVisible();
});

test("today's Rankle links to / and an unplayed past Rankle is never a link", async ({
  page,
}) => {
  await page.goto("/archive");
  await page.getByRole("link", { name: /fast food fries/i }).click();
  await expect(page).toHaveURL(/\/$/);

  // no submission path to old games, by design (docs/MANUAL.md sec 25)
  await page.goto("/archive");
  await expect(page.getByRole("link", { name: /retro snacks/i })).toHaveCount(0);
});

test("an authenticated viewer with no history sees an explicit 'Not played', not a guest's blank state", async ({
  page,
}) => {
  const email = uniqueEmail("archive-auth");
  await page.goto("/login");
  await signInViaMagicLink(page, email);

  await page.goto("/archive");
  const retroRow = page.locator("li").filter({ hasText: "Retro Snacks" });
  await expect(retroRow.getByText(/^not played$/i)).toBeVisible();
});

test("no horizontal overflow on /archive at mobile widths", async ({ page }) => {
  for (const width of [375, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/archive");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});
