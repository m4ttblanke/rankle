import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
const createClient = vi.fn(async () => ({ from }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { updateTierlist } = await import("./update-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  eq.mockResolvedValue({ error: null });
});

describe("updateTierlist", () => {
  it("rejects a non-admin without touching the database", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await updateTierlist({ id: ID, slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid id", async () => {
    const result = await updateTierlist({ id: "not-a-uuid", slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("updates only title/prompt/slug", async () => {
    await updateTierlist({ id: ID, slug: "new-slug", title: "New Title", prompt: "New prompt" });
    expect(update).toHaveBeenCalledWith({ slug: "new-slug", title: "New Title", prompt: "New prompt" });
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it("maps the historical-lock trigger's SQLSTATE to locked", async () => {
    eq.mockResolvedValue({ error: { code: "23001" } });
    const result = await updateTierlist({ id: ID, slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "locked" });
  });

  it("maps a unique-violation to taken", async () => {
    eq.mockResolvedValue({ error: { code: "23505" } });
    const result = await updateTierlist({ id: ID, slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "taken" });
  });
});
