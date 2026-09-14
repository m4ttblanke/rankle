import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";

/*
 * Admin & scheduling (Milestone 8), against the local Supabase stack — same
 * conventions as e2e/accounts.spec.ts (real magic-link sign-in via Mailpit,
 * no auth step mocked). `profiles.is_admin` has no client write path at all
 * (docs/SECURITY.md sec 4), so admin bootstrap here uses a service-role
 * client exactly as documented in docs/DEPLOY.md sec 16 — the same
 * production procedure, not a test-only shortcut.
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

const testEnv = loadEnvTest();
const MAILPIT_URL = testEnv.MAILPIT_URL ?? "http://127.0.0.1:54324";
const SUPABASE_URL = testEnv.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = testEnv.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

test.skip(!SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required to bootstrap an admin account for this spec");

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
  return `e2e-admin-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rankle.test`;
}

/** Sign in via real magic link, then bootstrap the account to admin via the
 *  documented service-role procedure (docs/DEPLOY.md sec 16). */
async function signInAsAdmin(page: Page): Promise<void> {
  const email = uniqueEmail("owner");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /^send sign-in link$/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/profile\/?$/);

  const { data: user } = await serviceClient!.auth.admin.listUsers();
  const match = user.users.find((u) => u.email === email);
  if (!match) throw new Error("admin user not found after sign-in");
  const { error } = await serviceClient!.from("profiles").update({ is_admin: true }).eq("id", match.id);
  if (error) throw error;

  // Fresh render after the promotion above — confirms the nav link reflects
  // real-time admin status, not a stale value from the earlier /profile load.
  await page.goto("/profile");
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
}

function futureDateString(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** A random offset per test run so repeated local runs (without an
 *  intervening `supabase db reset`) don't collide with a previous run's
 *  leftover rows at the same fixed date. */
function randomOffset(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

test("a signed-out visitor is redirected away from /admin and sees no Admin nav link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Admin" })).not.toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
});

test("a signed-in non-admin is redirected away from /admin and sees no Admin nav link", async ({ page }) => {
  const email = uniqueEmail("regular");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /^send sign-in link$/i }).click();
  const link = await getLatestMagicLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/profile\/?$/);
  await expect(page.getByRole("link", { name: "Admin" })).not.toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/$/);
});

test("full admin lifecycle: create, add items, schedule, duplicate-date rejected, unschedule, edit, reschedule", async ({
  page,
}) => {
  await signInAsAdmin(page);

  // ---- create --------------------------------------------------------
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await page.getByRole("link", { name: /new rankle/i }).click();

  const slug = `e2e-admin-${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Title").fill("E2E Admin Test Game");
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("button", { name: /^create draft$/i }).click();

  await expect(page.getByRole("heading", { level: 1, name: "E2E Admin Test Game" })).toBeVisible();
  await expect(page.getByText(/^draft$/i)).toBeVisible();

  // ---- add items -------------------------------------------------------
  await page.getByRole("button", { name: /\+ add item/i }).click();
  await page.getByRole("button", { name: /\+ add item/i }).click();
  const labelInputs = page.getByPlaceholder("Item label");
  await labelInputs.nth(0).fill("Alpha");
  await labelInputs.nth(1).fill("Beta");
  await page.getByRole("button", { name: /^save items$/i }).click();
  await expect(page.getByText(/^saved$/i)).toBeVisible();

  // preview reflects the saved items
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Alpha")).toBeVisible();
  await expect(page.getByText("Beta")).toBeVisible();

  // ---- schedule ----------------------------------------------------------
  const freeDate = futureDateString(randomOffset(15, 300));
  await page.locator('input[type="date"]').fill(freeDate);
  await page.getByRole("button", { name: /^schedule$/i }).click();
  await expect(page.getByText(/^scheduled$/i)).toBeVisible();

  // shows up in Upcoming on the dashboard
  await page.goto("/admin");
  await expect(
    page.getByRole("link", { name: new RegExp(`E2E Admin Test Game.*/${slug}`, "s") }),
  ).toBeVisible();

  // ---- duplicate release date is rejected ---------------------------------
  await page.goto("/admin/tierlists/new");
  const slug2 = `e2e-admin-${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Title").fill("E2E Admin Conflict Game");
  await page.getByLabel("Slug").fill(slug2);
  await page.getByRole("button", { name: /^create draft$/i }).click();
  await page.locator('input[type="date"]').fill(freeDate);
  await page.getByRole("button", { name: /^schedule$/i }).click();
  await expect(page.getByText(/already scheduled for that date/i)).toBeVisible();

  // ---- back to the first draft: unschedule, edit, reschedule --------------
  await page.goto("/admin");
  await page.getByRole("link", { name: new RegExp(`E2E Admin Test Game.*/${slug}`, "s") }).click();

  await page.getByRole("button", { name: /^unschedule$/i }).click();
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page.getByText(/^draft$/i)).toBeVisible();

  await page.getByLabel("Title").fill("E2E Admin Test Game (Edited)");
  await page.getByRole("button", { name: /^save changes$/i }).click();
  await expect(page.getByText(/^saved$/i)).toBeVisible();

  await page.locator('input[type="date"]').fill(futureDateString(randomOffset(310, 600)));
  await page.getByRole("button", { name: /^schedule$/i }).click();
  await expect(page.getByText(/^scheduled$/i)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Admin Test Game (Edited)" })).toBeVisible();
});

test("duplicate creates a fresh draft with copied items, not the original's schedule", async ({ page }) => {
  await signInAsAdmin(page);

  // Fast Food Fries is today's seeded live game — a realistic "duplicate a
  // game that worked well" source, including one with real items.
  await page.goto("/admin");
  await page
    .getByRole("link", { name: /fast food fries/i })
    .first()
    .click();

  const newSlug = `fast-food-fries-copy-${randomUUID().slice(0, 6)}`;
  await page.getByLabel("New slug").fill(newSlug);
  await page.getByRole("button", { name: /^duplicate$/i }).click();

  await expect(page).toHaveURL(/\/admin\/tierlists\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fast Food Fries" })).toBeVisible();
  await expect(page.getByText(/^draft$/i)).toBeVisible();
  await expect(page.getByText(/no release date/i)).toBeVisible();
  await expect(page.getByText(/0 official submissions/i)).toBeVisible();
  await expect(page.getByText("McDonald's")).toBeVisible();
});

test("a Rankle with official submissions is historically locked in the editor UI", async ({ page }) => {
  await signInAsAdmin(page);

  const slug = `e2e-locked-${randomUUID().slice(0, 8)}`;
  const { data: tierlist, error: createErr } = await serviceClient!
    .from("tierlists")
    .insert({ slug, title: "E2E Locked Game", status: "scheduled", release_date: futureDateString(-randomOffset(200, 900)) })
    .select("id")
    .single();
  expect(createErr).toBeNull();

  const { data: item, error: itemErr } = await serviceClient!
    .from("tierlist_items")
    .insert({ tierlist_id: tierlist!.id, label: "Only Item", sort_order: 0 })
    .select("id")
    .single();
  expect(itemErr).toBeNull();

  const { error: subErr } = await serviceClient!
    .from("submissions")
    .insert({ tierlist_id: tierlist!.id, guest_id: randomUUID() })
    .select("id")
    .single();
  expect(subErr).toBeNull();
  void item;

  await page.goto(`/admin/tierlists/${tierlist!.id}`);
  await expect(page.getByText(/historical content now/i)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^save items$/i })).toHaveCount(0);
  await expect(page.getByText("Only Item").first()).toBeVisible();
});
