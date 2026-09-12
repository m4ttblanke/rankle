import { beforeEach, expect, it, vi } from "vitest";

/** removeFriend Server Action (Milestone 7) — either participant may remove;
 *  `remove_friend` itself derives the pair from auth.uid() + p_user_id, so
 *  there is no separate "forbidden" case to map here (unlike the request
 *  actions) -- any signed-in caller may attempt to remove any pair they are
 *  actually part of, and removing a non-friendship is a harmless no-op. */

const getUser = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { removeFriend } = await import("./remove-friend");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const FRIEND_ID = "88888888-8888-4888-8888-888888888888";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  rpc.mockResolvedValue({ data: true, error: null });
});

it("rejects a malformed userId without calling the database", async () => {
  const result = await removeFriend({ userId: "nope" });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
});

it("refuses when signed out", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const result = await removeFriend({ userId: FRIEND_ID });
  expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  expect(rpc).not.toHaveBeenCalled();
});

it("calls the RPC and revalidates both /friends and /results on success", async () => {
  const result = await removeFriend({ userId: FRIEND_ID });
  expect(rpc).toHaveBeenCalledWith("remove_friend", { p_user_id: FRIEND_ID });
  expect(result).toEqual({ ok: true, removed: true });
  expect(revalidatePath).toHaveBeenCalledWith("/friends");
  expect(revalidatePath).toHaveBeenCalledWith("/results");
});

it("removing an already-removed (or never-existing) friendship is a safe idempotent no-op", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const result = await removeFriend({ userId: FRIEND_ID });
  expect(result).toEqual({ ok: true, removed: false });
});

it("maps any RPC error to network, without leaking database detail", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "policy detail" } });
  const result = await removeFriend({ userId: FRIEND_ID });
  expect(result).toEqual({ ok: false, reason: "network" });
});

it("maps a thrown failure to network", async () => {
  rpc.mockRejectedValue(new Error("fetch failed"));
  const result = await removeFriend({ userId: FRIEND_ID });
  expect(result).toEqual({ ok: false, reason: "network" });
});
