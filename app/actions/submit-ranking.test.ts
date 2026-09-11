import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The submission Server Action boundary (Milestone 3). Both collaborators are
 * mocked: identity must come only from `ensureGuestId()` (never the payload),
 * and the RLS client's `rpc` call is the only path to `submit_ranking` — never
 * a service-role client.
 */

const ensureGuestId = vi.fn();
vi.mock("@/lib/game/guest", () => ({ ensureGuestId }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { submitRanking } = await import("./submit-ranking");

const GAME_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  ensureGuestId.mockResolvedValue(GUEST_ID);
  rpc.mockResolvedValue({ data: "submission-id", error: null });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    tierlistId: GAME_ID,
    items: [{ item_id: ITEM_ID, tier: "S", position: 0 }],
    ...overrides,
  };
}

describe("submitRanking — validation", () => {
  it("rejects a malformed payload without ever calling the database", async () => {
    const result = await submitRanking({ tierlistId: "not-a-uuid", items: [] });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an incomplete/empty items array", async () => {
    const result = await submitRanking(validInput({ items: [] }));
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("an extra top-level field (e.g. a spoofed guestId) invalidates the whole request", async () => {
    const result = await submitRanking(
      validInput({ guestId: "44444444-4444-4444-8444-444444444444" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("submitRanking — identity", () => {
  it("identity comes only from ensureGuestId(), never from the request body", async () => {
    await submitRanking(validInput());
    expect(ensureGuestId).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("submit_ranking", {
      p_tierlist_id: GAME_ID,
      p_items: [{ item_id: ITEM_ID, tier: "S", position: 0 }],
      p_guest_id: GUEST_ID,
    });
  });

  it("a p_guest_id smuggled onto the payload is rejected, not forwarded", async () => {
    // .strict() rejects the unknown field outright — the RPC never sees it.
    const result = await submitRanking(
      validInput({ p_guest_id: "should-be-ignored-and-actually-rejected" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never touches a service-role client — only lib/supabase/server's RLS client", async () => {
    await submitRanking(validInput());
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});

describe("submitRanking — success and error mapping", () => {
  it("returns ok on success", async () => {
    const result = await submitRanking(validInput());
    expect(result).toEqual({ ok: true });
  });

  it.each([
    ["23505", "already"],
    ["23001", "closed"],
    ["22023", "invalid"],
    ["23514", "invalid"],
    ["P0002", "invalid"],
    ["40001", "network"], // unmapped code -> generic, non-leaky fallback
    [undefined, "network"],
  ] as const)("maps Postgres code %s to reason %s", async (code, reason) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "db detail" } });
    const result = await submitRanking(validInput());
    expect(result).toEqual({ ok: false, reason });
  });

  it("never leaks raw database error text to the caller", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "column x.y does not exist at line 42" },
    });
    const result = await submitRanking(validInput());
    expect(JSON.stringify(result)).not.toMatch(/does not exist|line 42/);
  });

  it("a thrown/network failure from the RPC call maps to network", async () => {
    rpc.mockRejectedValue(new Error("fetch failed"));
    const result = await submitRanking(validInput());
    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("a failure establishing guest identity maps to network and never calls the RPC", async () => {
    ensureGuestId.mockRejectedValue(new Error("cookie store unavailable"));
    const result = await submitRanking(validInput());
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
