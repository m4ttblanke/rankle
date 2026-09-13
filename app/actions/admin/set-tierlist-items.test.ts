import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { setTierlistItems } = await import("./set-tierlist-items");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ error: null });
});

describe("setTierlistItems", () => {
  it("rejects a non-admin without calling the RPC", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await setTierlistItems({ id: ID, items: [{ label: "A", sortOrder: 0 }] });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an empty item list", async () => {
    const result = await setTierlistItems({ id: ID, items: [] });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-https image URL before calling the RPC", async () => {
    const result = await setTierlistItems({
      id: ID,
      items: [{ label: "A", imageUrl: "http://insecure.example.com/x.png", sortOrder: 0 }],
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps camelCase input to the RPC's snake_case jsonb shape", async () => {
    await setTierlistItems({
      id: ID,
      items: [
        { label: "Alpha", imageUrl: "https://example.com/a.png", sortOrder: 0 },
        { label: "Beta", sortOrder: 1 },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("set_tierlist_items", {
      p_tierlist_id: ID,
      p_items: [
        { label: "Alpha", image_url: "https://example.com/a.png", sort_order: 0 },
        { label: "Beta", image_url: null, sort_order: 1 },
      ],
    });
  });

  it.each([
    ["23001", "locked"],
    ["P0002", "not_found"],
    ["42501", "forbidden"],
    ["40001", "network"],
  ] as const)("maps Postgres code %s to reason %s", async (code, reason) => {
    rpc.mockResolvedValue({ error: { code } });
    const result = await setTierlistItems({ id: ID, items: [{ label: "A", sortOrder: 0 }] });
    expect(result).toEqual({ ok: false, reason });
  });
});
