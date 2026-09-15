import { test, expect } from "@playwright/test";

/*
 * Canonical-domain migration (docs/DEPLOY.md sec 25, sec 14). `next.config.ts`
 * redirects the old Vercel-issued production hostname and `www.rankle.io` to
 * the apex, preserving path and query string, without ever matching the
 * apex itself (no loop). These requests never leave localhost — only the
 * `Host` header is spoofed against the local dev server, so this never talks
 * to production.
 */

test.describe("old-hostname and www redirects", () => {
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

  test("www.rankle.io redirects to the apex", async ({ page }) => {
    const res = await page.request.get("/share/deadbeefdeadbeefdeadbeefdeadbeef", {
      headers: { host: "www.rankle.io" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(
      "https://rankle.io/share/deadbeefdeadbeefdeadbeefdeadbeef",
    );
  });

  test("rankle.io itself is never redirected", async ({ page }) => {
    const res = await page.request.get("/login", {
      headers: { host: "rankle.io" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
  });
});
