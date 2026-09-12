import { beforeEach, expect, it, vi } from "vitest";

/**
 * acceptFriendRequest Server Action (Milestone 7). Recipient-only —
 * `accept_friend_request` itself raises `42501` for the sender or an
 * unrelated user; this action only shape-validates and maps that error.
 */

const getUser = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { acceptFriendRequest } = await import("./accept-friend-request");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  rpc.mockResolvedValue({ data: true, error: null });
});

it("rejects a malformed requestId without calling the database", async () => {
  const result = await acceptFriendRequest({ requestId: "nope" });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
});

it("refuses when signed out", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const result = await acceptFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  expect(rpc).not.toHaveBeenCalled();
});

it("calls the RPC with the request id and revalidates /friends on success", async () => {
  const result = await acceptFriendRequest({ requestId: REQUEST_ID });
  expect(rpc).toHaveBeenCalledWith("accept_friend_request", { p_request_id: REQUEST_ID });
  expect(result).toEqual({ ok: true, accepted: true });
  expect(revalidatePath).toHaveBeenCalledWith("/friends");
});

it("an already-resolved request (no row found) is a safe no-op, not an error", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const result = await acceptFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: true, accepted: false });
});

it("maps insufficient_privilege (sender or an unrelated user) to forbidden", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not your request" } });
  const result = await acceptFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "forbidden" });
});

it("maps a thrown failure to network", async () => {
  rpc.mockRejectedValue(new Error("fetch failed"));
  const result = await acceptFriendRequest({ requestId: REQUEST_ID });
  expect(result).toEqual({ ok: false, reason: "network" });
});
