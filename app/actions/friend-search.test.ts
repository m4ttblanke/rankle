import { beforeEach, expect, it, vi } from "vitest";

/**
 * friendSearch Server Action (Milestone 7) — thin validation wrapper around
 * `searchProfiles()` (`lib/game/friends.ts`), which itself calls the
 * authenticated-only `search_profiles` RPC and already swallows any
 * auth/RPC failure to `[]`. This action only needs to prove it validates the
 * query shape and forwards the trimmed value.
 */

const searchProfiles = vi.fn();
vi.mock("@/lib/game/friends", () => ({ searchProfiles }));

const { friendSearch } = await import("./friend-search");

beforeEach(() => {
  vi.clearAllMocks();
  searchProfiles.mockResolvedValue([]);
});

it("rejects a query over the max length without calling the reader", async () => {
  const result = await friendSearch({ query: "a".repeat(51) });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(searchProfiles).not.toHaveBeenCalled();
});

it("rejects a non-string query", async () => {
  const result = await friendSearch({ query: 123 });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(searchProfiles).not.toHaveBeenCalled();
});

it("rejects an extra top-level field (.strict())", async () => {
  const result = await friendSearch({ query: "car", extra: true });
  expect(result).toEqual({ ok: false, reason: "invalid" });
  expect(searchProfiles).not.toHaveBeenCalled();
});

it("forwards a valid query and returns the reader's results", async () => {
  const results = [
    { id: "1", username: "carol", displayName: "Carol", avatarUrl: null, relationship: "none" as const },
  ];
  searchProfiles.mockResolvedValue(results);
  const result = await friendSearch({ query: "car" });
  expect(searchProfiles).toHaveBeenCalledWith("car");
  expect(result).toEqual({ ok: true, results });
});
