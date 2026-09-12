import { beforeEach, expect, it, vi } from "vitest";

/** cancelFriendRequest Server Action (Milestone 7) — sender-only, distinct
 *  from decline (recipient-only). */

const getUser = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { cancelFriendRequest } = await import("./cancel-friend-request");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  rpc.mockResolvedValue({ data: true, error: null });
});

it("rejects a malformed requestId without calling the database", async () => {
  const result = await cancelFriendRequest({ requestId: "nope" });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
});

it("refuses when signed out", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const result = await cancelFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  expect(rpc).not.toHaveBeenCalled();
});

it("calls the RPC with the request id and revalidates /friends on success", async () => {
  const result = await cancelFriendRequest({ requestId: REQUEST_ID });
  expect(rpc).toHaveBeenCalledWith("cancel_friend_request", { p_request_id: REQUEST_ID });
  expect(result).toEqual({ ok: true, canceled: true });
  expect(revalidatePath).toHaveBeenCalledWith("/friends");
});

it("canceling an already-accepted (now-gone) request is a safe no-op, never touches the friendship", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const result = await cancelFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: true, canceled: false });
});

it("maps insufficient_privilege (recipient or an unrelated user attempting to cancel) to forbidden", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not your request" } });
  const result = await cancelFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "forbidden" });
});

it("maps a thrown failure to network", async () => {
  rpc.mockRejectedValue(new Error("fetch failed"));
  const result = await cancelFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "network" });
});
