import { beforeEach, expect, it, vi } from "vitest";

/**
 * `hasSubmittedRanking` (Milestone 3; Milestone 6 fix). The one behavior this
 * guards against regressing: it must not short-circuit to `false` for a
 * signed-in caller who happens to have no guest cookie — the RPC itself
 * resolves identity (auth first, guest as fallback), so this reader must
 * always ask it.
 */

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { hasSubmittedRanking } = await import("./submission-state");

const GAME_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

it("calls the RPC even when guestId is null (Milestone 6: an authenticated caller may have no guest cookie)", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  const result = await hasSubmittedRanking(GAME_ID, null);
  expect(rpc).toHaveBeenCalledWith("has_submitted_ranking", {
    p_tierlist_id: GAME_ID,
    p_guest_id: undefined,
  });
  expect(result).toBe(true);
});

it("returns true when the RPC says so, for a guest identity", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  const result = await hasSubmittedRanking(GAME_ID, "guest-id");
  expect(rpc).toHaveBeenCalledWith("has_submitted_ranking", {
    p_tierlist_id: GAME_ID,
    p_guest_id: "guest-id",
  });
  expect(result).toBe(true);
});

it("returns false when the RPC says so", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect(await hasSubmittedRanking(GAME_ID, null)).toBe(false);
});

it("treats an RPC error as not-submitted, never throwing", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "500", message: "boom" } });
  expect(await hasSubmittedRanking(GAME_ID, null)).toBe(false);
});

it("treats a thrown/network failure as not-submitted, never throwing", async () => {
  rpc.mockRejectedValue(new Error("fetch failed"));
  expect(await hasSubmittedRanking(GAME_ID, null)).toBe(false);
});
