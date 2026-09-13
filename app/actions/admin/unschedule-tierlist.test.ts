import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { unscheduleTierlist } = await import("./unschedule-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ error: null });
});

describe("unscheduleTierlist", () => {
  it("rejects a non-admin without calling the RPC", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await unscheduleTierlist({ id: ID });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("calls unschedule_tierlist with the right id", async () => {
    await unscheduleTierlist({ id: ID });
    expect(rpc).toHaveBeenCalledWith("unschedule_tierlist", { p_tierlist_id: ID });
  });

  it("maps not-a-future-scheduled-game to not_future", async () => {
    rpc.mockResolvedValue({ error: { code: "P0002" } });
    const result = await unscheduleTierlist({ id: ID });
    expect(result).toEqual({ ok: false, reason: "not_future" });
  });

  it("maps an unmapped code to network", async () => {
    rpc.mockResolvedValue({ error: { code: "40001" } });
    const result = await unscheduleTierlist({ id: ID });
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});
