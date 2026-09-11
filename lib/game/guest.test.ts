import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guest identity (Milestone 3): a random uuid in a signed, httpOnly cookie.
 * `next/headers` is mocked with an in-memory store standing in for the request
 * cookie jar, so `getGuestId` / `ensureGuestId` can be exercised without a real
 * Next.js request.
 */

const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      store.set(name, value);
    },
  })),
}));

const {
  ensureGuestId,
  getGuestId,
  guestCookieOptions,
  parseGuestCookie,
  serializeGuestCookie,
  GUEST_COOKIE_NAME,
} = await import("./guest");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  store.clear();
  process.env.GUEST_COOKIE_SECRET = "test-only-secret-do-not-use-in-prod";
  vi.stubEnv("NODE_ENV", "test");
});

describe("serializeGuestCookie / parseGuestCookie", () => {
  it("round-trips a valid id", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    expect(parseGuestCookie(serializeGuestCookie(id))).toBe(id);
  });

  it("rejects a tampered signature", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const [uuid] = serializeGuestCookie(id).split(".");
    expect(parseGuestCookie(`${uuid}.notarealsignature`)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const cookie = serializeGuestCookie(id);
    process.env.GUEST_COOKIE_SECRET = "a-completely-different-secret-value";
    expect(parseGuestCookie(cookie)).toBeNull();
  });

  it("rejects a malformed uuid even with a well-formed signature shape", () => {
    expect(parseGuestCookie("not-a-uuid.somesignature")).toBeNull();
  });

  it("rejects missing / empty input", () => {
    expect(parseGuestCookie(undefined)).toBeNull();
    expect(parseGuestCookie("")).toBeNull();
    expect(parseGuestCookie("no-dot-in-here")).toBeNull();
  });
});

describe("guestCookieOptions", () => {
  it("is httpOnly, SameSite=Lax, path=/, ~400 days", () => {
    const opts = guestCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(60 * 60 * 24 * 400);
  });

  it("is Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(guestCookieOptions().secure).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(guestCookieOptions().secure).toBe(true);
  });
});

describe("getGuestId / ensureGuestId", () => {
  it("getGuestId returns null when there is no cookie", async () => {
    expect(await getGuestId()).toBeNull();
  });

  it("ensureGuestId mints a fresh, valid uuid and sets the cookie", async () => {
    const id = await ensureGuestId();
    expect(id).toMatch(UUID_RE);
    expect(store.has(GUEST_COOKIE_NAME)).toBe(true);
  });

  it("a cookie set by ensureGuestId is readable by getGuestId", async () => {
    const id = await ensureGuestId();
    expect(await getGuestId()).toBe(id);
  });

  it("ensureGuestId is idempotent once a valid cookie exists", async () => {
    const first = await ensureGuestId();
    const second = await ensureGuestId();
    expect(second).toBe(first);
  });

  it("a tampered cookie in the jar is treated as absent by getGuestId", async () => {
    store.set(GUEST_COOKIE_NAME, "11111111-2222-4333-8444-555555555555.garbage");
    expect(await getGuestId()).toBeNull();
  });

  it("ensureGuestId mints a new id when the existing cookie is tampered", async () => {
    store.set(GUEST_COOKIE_NAME, "11111111-2222-4333-8444-555555555555.garbage");
    const id = await ensureGuestId();
    expect(id).toMatch(UUID_RE);
    expect(id).not.toBe("11111111-2222-4333-8444-555555555555");
  });
});

describe("secret validation", () => {
  it("throws a clear error when GUEST_COOKIE_SECRET is missing", () => {
    delete process.env.GUEST_COOKIE_SECRET;
    expect(() => serializeGuestCookie("11111111-2222-4333-8444-555555555555")).toThrow(
      /GUEST_COOKIE_SECRET/,
    );
  });

  it("throws when GUEST_COOKIE_SECRET is too short", () => {
    process.env.GUEST_COOKIE_SECRET = "short";
    expect(() => serializeGuestCookie("11111111-2222-4333-8444-555555555555")).toThrow(
      /GUEST_COOKIE_SECRET/,
    );
  });
});
