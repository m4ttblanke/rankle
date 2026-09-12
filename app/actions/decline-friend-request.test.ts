import { beforeEach, expect, it, vi } from "vitest";

/** declineFriendRequest Server Action (Milestone 7) — recipient-only. */

const getUser = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { declineFriendRequest } = await import("./decline-friend-request");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  rpc.mockResolvedValue({ data: true, error: null });
});

it("rejects a malformed requestId without calling the database", async () => {
  const result = await declineFriendRequest({ requestId: "nope" });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
});

it("refuses when signed out", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const result = await declineFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  expect(rpc).not.toHaveBeenCalled();
});

it("calls the RPC with the request id and revalidates /friends on success", async () => {
  const result = await declineFriendRequest({ requestId: REQUEST_ID });
  expect(rpc).toHaveBeenCalledWith("decline_friend_request", { p_request_id: REQUEST_ID });
  expect(result).toEqual({ ok: true, declined: true });
  expect(revalidatePath).toHaveBeenCalledWith("/friends");
});

it("an already-resolved request is a safe no-op", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const result = await declineFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: true, declined: false });
});

it("maps insufficient_privilege (not the recipient) to forbidden", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not your request" } });
  const result = await declineFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "forbidden" });
});

it("maps a thrown failure to network", async () => {
  rpc.mockRejectedValue(new Error("fetch failed"));
  const result = await declineFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "network" });
});
