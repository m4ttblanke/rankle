import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const eq = vi.fn();
const del = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ delete: del }));
const createClient = vi.fn(async () => ({ from }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { deleteTierlist } = await import("./delete-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  eq.mockResolvedValue({ error: null });
});

describe("deleteTierlist", () => {
  it("rejects a non-admin without touching the database", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await deleteTierlist({ id: ID });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("deletes the row by id", async () => {
    await deleteTierlist({ id: ID });
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it("maps the historical-lock trigger's SQLSTATE to locked (deletion cannot cascade into real submissions)", async () => {
    eq.mockResolvedValue({ error: { code: "23001" } });
    const result = await deleteTierlist({ id: ID });
    expect(result).toEqual({ ok: false, reason: "locked" });
  });

  it("succeeds when nothing blocks it", async () => {
    const result = await deleteTierlist({ id: ID });
    expect(result).toEqual({ ok: true });
  });
});
