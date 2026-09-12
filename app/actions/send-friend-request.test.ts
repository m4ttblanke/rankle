import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * sendFriendRequest Server Action (Milestone 7). Identity comes only from
 * the caller's own session (`auth.getUser()`); `recipientId` is untrusted
 * input, shape-validated here and re-verified by `send_friend_request`
 * itself. Mirrors `update-profile.test.ts`'s mocking structure.
 */

const getUser = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { sendFriendRequest } = await import("./send-friend-request");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const RECIPIENT_ID = "66666666-6666-4666-8666-666666666666";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  rpc.mockResolvedValue({ data: { status: "pending" }, error: null });
});

describe("sendFriendRequest — validation", () => {
  it("rejects a malformed recipientId without ever calling the database", async () => {
    const result = await sendFriendRequest({ recipientId: "not-a-uuid" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an extra top-level field (.strict())", async () => {
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID, extra: 1 });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("sendFriendRequest — identity", () => {
  it("refuses when signed out, without calling the RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes recipientId to the RPC; identity itself comes from the session, not the payload", async () => {
    await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(rpc).toHaveBeenCalledWith("send_friend_request", { p_recipient_id: RECIPIENT_ID });
  });
});

describe("sendFriendRequest — result mapping", () => {
  it.each(["pending", "friends", "already_pending"] as const)(
    "returns status %s on success and revalidates /friends",
    async (status) => {
      rpc.mockResolvedValue({ data: { status }, error: null });
      const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
      expect(result).toEqual({ ok: true, status });
      expect(revalidatePath).toHaveBeenCalledWith("/friends");
    },
  );

  it("maps a self-request check_violation to reason: self", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "self" } });
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(result).toEqual({ ok: false, reason: "self" });
  });

  it("maps a missing-recipient no_data_found to reason: not_found", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "not found" } });
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("maps any other error to network, without leaking database detail", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "policy detail" } });
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("maps a thrown failure to network", async () => {
    rpc.mockRejectedValue(new Error("fetch failed"));
    const result = await sendFriendRequest({ recipientId: RECIPIENT_ID });
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});
