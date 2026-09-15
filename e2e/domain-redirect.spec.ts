import { test, expect } from "@playwright/test";

/*
 * Canonical-domain migration (docs/DEPLOY.md sec 25, sec 14). `next.config.ts`
 * redirects the old Vercel-issued production hostname to the apex, preserving
 * path and query string, without ever matching the apex itself (no loop).
 * `www.rankle.io` is deliberately NOT handled here — Vercel has its own
 * domain-level redirect for it (found to still be apex->www, not yet
 * apex-primary; see the note in next.config.ts and docs/TODO.md), and an
 * app-level rule on top of that caused a live redirect loop in production.
 * These requests never leave localhost — only the `Host` header is spoofed
 * against the local dev server, so this never talks to production.
 */

test.describe("old-hostname redirect", () => {
  test("rankle-theta.vercel.app preserves path", async ({ page }) => {
    const res = await page.request.get("/archive", {
      headers: { host: "rankle-theta.vercel.app" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe("https://rankle.io/archive");
  });

  test("rankle-theta.vercel.app preserves query string", async ({ page }) => {
    const res = await page.request.get("/?share=deadbeefdeadbeefdeadbeefdeadbeef", {
      headers: { host: "rankle-theta.vercel.app" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    // Root path collapses `:path*` to empty, so Next.js omits the trailing
    // slash — functionally identical (same origin, same query, path defaults
    // to `/`), just not byte-identical to the source URL.
    expect(res.headers()["location"]).toBe(
      "https://rankle.io?share=deadbeefdeadbeefdeadbeefdeadbeef",
    );
  });

  test("rankle.io itself is never redirected", async ({ page }) => {
    const res = await page.request.get("/login", {
      headers: { host: "rankle.io" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
  });

  test("www.rankle.io is left alone at the app level", async ({ page }) => {
    // This app issues no redirect for www — it's Vercel's domain config to
    // handle. Confirms the app itself never reintroduces the loop.
    const res = await page.request.get("/login", {
      headers: { host: "www.rankle.io" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
  });
});
