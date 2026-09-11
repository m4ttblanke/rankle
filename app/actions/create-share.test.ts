import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The share-creation Server Action boundary (Milestone 5). Both collaborators
 * are mocked: identity must come only from `getGuestId()` (never the request
 * body), and the RLS client's `rpc` call is the only path to `create_share` —
 * never a service-role client. Mirrors `submit-ranking.test.ts`'s structure.
 */

const getGuestId = vi.fn();
vi.mock("@/lib/game/guest", () => ({ getGuestId }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createShare } = await import("./create-share");

const SUBMISSION_ID = "22222222-2222-4222-8222-222222222222";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "abcdef0123456789abcdef0123456789";

beforeEach(() => {
  vi.clearAllMocks();
  getGuestId.mockResolvedValue(GUEST_ID);
  rpc.mockResolvedValue({ data: TOKEN, error: null });
});

describe("createShare — validation", () => {
  it("rejects a malformed submissionId without ever calling the database", async () => {
    const result = await createShare({ submissionId: "not-a-uuid" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("an extra top-level field is rejected outright (.strict())", async () => {
    const result = await createShare({
      submissionId: SUBMISSION_ID,
      guestId: "should-be-ignored-and-actually-rejected",
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("createShare — identity", () => {
  it("identity comes only from getGuestId(), never from the request body", async () => {
    await createShare({ submissionId: SUBMISSION_ID });
    expect(getGuestId).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("create_share", {
      p_submission_id: SUBMISSION_ID,
      p_guest_id: GUEST_ID,
    });
  });

  it("a p_guest_id smuggled onto the payload is rejected, not forwarded", async () => {
    const result = await createShare({
      submissionId: SUBMISSION_ID,
      p_guest_id: "should-be-ignored-and-actually-rejected",
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never touches a service-role client — only lib/supabase/server's RLS client", async () => {
    await createShare({ submissionId: SUBMISSION_ID });
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("does not mint a guest identity — a caller with no guest cookie yet gets p_guest_id: undefined", async () => {
    getGuestId.mockResolvedValue(null);
    await createShare({ submissionId: SUBMISSION_ID });
    expect(rpc).toHaveBeenCalledWith("create_share", {
      p_submission_id: SUBMISSION_ID,
      p_guest_id: undefined,
    });
  });
});

describe("createShare — success and error mapping", () => {
  it("returns the token on success", async () => {
    const result = await createShare({ submissionId: SUBMISSION_ID });
    expect(result).toEqual({ ok: true, token: TOKEN });
  });

  it.each([
    ["P0002", "invalid"], // no_data_found -- submission id does not exist
    ["42501", "forbidden"], // insufficient_privilege -- not this identity's submission
    ["40001", "network"], // unmapped code -> generic, non-leaky fallback
    [undefined, "network"],
  ] as const)("maps Postgres code %s to reason %s", async (code, reason) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "db detail" } });
    const result = await createShare({ submissionId: SUBMISSION_ID });
    expect(result).toEqual({ ok: false, reason });
  });

  it("never leaks raw database error text to the caller", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "policy detail line 42" },
    });
    const result = await createShare({ submissionId: SUBMISSION_ID });
    expect(JSON.stringify(result)).not.toMatch(/policy detail|line 42/);
  });

  it("a thrown/network failure from the RPC call maps to network", async () => {
    rpc.mockRejectedValue(new Error("fetch failed"));
    const result = await createShare({ submissionId: SUBMISSION_ID });
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});
