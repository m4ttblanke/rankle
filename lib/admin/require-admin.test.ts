import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `requireAdmin()` itself calls `redirect()`, which needs a real Next.js
 * request context to behave meaningfully — like every other `redirect()`-based
 * gate in this project (`/profile`, `/results`), that path is covered by
 * Playwright e2e, not a Vitest unit test. `isCurrentUserAdmin()` is a plain
 * boolean-returning function used by every admin Server Action, so it is
 * unit-tested directly here.
 */

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { isCurrentUserAdmin } = await import("./require-admin");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isCurrentUserAdmin", () => {
  it("is false when signed out, without calling the database", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await isCurrentUserAdmin()).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("is false for a signed-in non-admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: null });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it("is true for a signed-in admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: null });
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await isCurrentUserAdmin()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_admin_user");
  });

  it("is false when the RPC errors, never fails open", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: null });
    rpc.mockResolvedValue({ data: null, error: { code: "500" } });
    expect(await isCurrentUserAdmin()).toBe(false);
  });
});
