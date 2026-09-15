import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The analytics transport boundary itself (Product Analytics milestone,
 * docs/TODO.md) — the one thing every call site in this codebase trusts to
 * never throw, never block, and never write outside production.
 */

const after = vi.hoisted(() => vi.fn((cb: () => unknown) => cb()));
vi.mock("next/server", () => ({ after }));

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const insert = vi.fn();
const from = vi.fn((table: string) =>
  table === "shares" ? { select } : { insert },
);
const createServiceRoleClient = vi.fn(() => ({ from }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient }));

const { logAnalyticsEvent } = await import("./log");

const originalVercelEnv = process.env.VERCEL_ENV;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  maybeSingle.mockResolvedValue({ data: { id: "share-uuid" } });
});

afterEach(() => {
  vi.stubEnv("VERCEL_ENV", originalVercelEnv ?? "");
  vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
});

describe("logAnalyticsEvent — environment gating", () => {
  it("does not write, and never touches the service-role client, with no VERCEL_ENV set (local dev, test runs)", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    await logAnalyticsEvent({ eventName: "daily_game_viewed" });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not write on a Vercel Preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await logAnalyticsEvent({ eventName: "daily_game_viewed" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not write on Vercel Development", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    await logAnalyticsEvent({ eventName: "daily_game_viewed" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("REGRESSION: NODE_ENV === 'production' alone is NOT enough — every Vercel deployment (Preview included) builds with NODE_ENV=production, so gating on NODE_ENV alone would leak Preview traffic into production analytics. VERCEL_ENV is the only thing that actually distinguishes them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    await logAnalyticsEvent({ eventName: "daily_game_viewed" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("writes only when VERCEL_ENV is production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await logAnalyticsEvent({ eventName: "daily_game_viewed" });
    expect(insert).toHaveBeenCalled();
  });
});

describe("logAnalyticsEvent — writing (production)", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("inserts the expected row shape, defaulting absent identity/properties to null/{}", async () => {
    await logAnalyticsEvent({ eventName: "daily_game_viewed", tierlistId: "t1" });
    expect(insert).toHaveBeenCalledWith({
      event_name: "daily_game_viewed",
      tierlist_id: "t1",
      user_id: null,
      guest_id: null,
      share_id: null,
      properties: {},
    });
  });

  it("resolves a share token to shares.id internally, and never persists the raw token", async () => {
    await logAnalyticsEvent({
      eventName: "share_opened",
      shareToken: "abcdef0123456789abcdef0123456789",
    });
    expect(eq).toHaveBeenCalledWith("token", "abcdef0123456789abcdef0123456789");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ share_id: "share-uuid" }),
    );
    const inserted = insert.mock.calls[0][0];
    expect(JSON.stringify(inserted)).not.toMatch(/abcdef0123456789abcdef0123456789/);
  });

  it("an unresolvable share token inserts share_id: null rather than failing the whole write", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    await logAnalyticsEvent({ eventName: "share_opened", shareToken: "deadbeef" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ share_id: null }),
    );
  });
});

describe("logAnalyticsEvent — never breaks the caller", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("a failed insert resolves normally, not a rejection", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "denied" } });
    await expect(
      logAnalyticsEvent({ eventName: "ranking_submitted" }),
    ).resolves.toBeUndefined();
  });

  it("a thrown error from the service-role client resolves normally, not a rejection", async () => {
    createServiceRoleClient.mockImplementation(() => {
      throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
    });
    await expect(
      logAnalyticsEvent({ eventName: "ranking_submitted" }),
    ).resolves.toBeUndefined();
  });

  it("after() itself throwing (called outside a request scope) never surfaces to the caller", async () => {
    after.mockImplementation(() => {
      throw new Error("after() called outside a request scope");
    });
    await expect(
      logAnalyticsEvent({ eventName: "ranking_submitted" }),
    ).resolves.toBeUndefined();
  });
});
