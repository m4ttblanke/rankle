import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { scheduleTierlist } = await import("./schedule-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ error: null });
});

describe("scheduleTierlist", () => {
  it("rejects a non-admin without calling the RPC", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await scheduleTierlist({ id: ID, releaseDate: "2026-10-01" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const result = await scheduleTierlist({ id: ID, releaseDate: "10/01/2026" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls schedule_tierlist with the right args", async () => {
    await scheduleTierlist({ id: ID, releaseDate: "2026-10-01" });
    expect(rpc).toHaveBeenCalledWith("schedule_tierlist", { p_tierlist_id: ID, p_release_date: "2026-10-01" });
  });

  it.each([
    ["22023", "past"],
    ["23505", "taken"],
    ["23001", "locked"],
    ["P0002", "not_found"],
    ["42501", "forbidden"],
    ["40001", "network"],
  ] as const)("maps Postgres code %s to reason %s", async (code, reason) => {
    rpc.mockResolvedValue({ error: { code } });
    const result = await scheduleTierlist({ id: ID, releaseDate: "2026-10-01" });
    expect(result).toEqual({ ok: false, reason });
  });
});
