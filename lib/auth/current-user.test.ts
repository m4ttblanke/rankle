import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Current-identity readers (Milestone 6). `getCurrentUser` must use
 * `auth.getUser()` (JWT-verified), never `auth.getSession()` — this is
 * asserted directly since a future edit swapping it back to `getSession()`
 * would be a real security regression (trusting an unrevalidated cookie for
 * anything access-gating).
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createClient = vi.fn(async () => ({ auth: { getUser }, from }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { getCurrentUser, getCurrentProfile } = await import("./current-user");

const USER_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("returns the user when auth.getUser() succeeds", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "a@b.com" } }, error: null });
    expect(await getCurrentUser()).toEqual({ id: USER_ID, email: "a@b.com" });
  });

  it("returns null when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns null on an auth error rather than throwing", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("null email is preserved as null, not undefined leaking through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: null } }, error: null });
    expect(await getCurrentUser()).toEqual({ id: USER_ID, email: null });
  });
});

describe("getCurrentProfile", () => {
  it("returns null when signed out, without querying profiles", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentProfile()).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("fetches and shapes the caller's own profile row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "a@b.com" } }, error: null });
    maybeSingle.mockResolvedValue({
      data: {
        id: USER_ID,
        username: "mattb",
        display_name: "Matt",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
    expect(await getCurrentProfile()).toEqual({
      id: USER_ID,
      username: "mattb",
      displayName: "Matt",
      avatarUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("returns null if the profile row is somehow missing, rather than throwing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER_ID, email: "a@b.com" } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getCurrentProfile()).toBeNull();
  });
});
