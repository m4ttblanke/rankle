import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));

const single = vi.fn();
const select = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select }));
const from = vi.fn(() => ({ insert }));
const getUser = vi.fn();
const createClient = vi.fn(async () => ({ from, auth: { getUser } }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createTierlist } = await import("./create-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  single.mockResolvedValue({ data: { id: "new-id" }, error: null });
});

describe("createTierlist", () => {
  it("rejects a non-admin without touching the database", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await createTierlist({ slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid slug", async () => {
    const result = await createTierlist({ slug: "Not Valid!", title: "X" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied status/release_date/tier_config (.strictObject)", async () => {
    const result = await createTierlist({ slug: "x", title: "X", status: "live" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("inserts only slug/title/prompt/created_by, letting status/release_date/tier_config default", async () => {
    await createTierlist({ slug: "fast-food-fries", title: "Fast Food Fries", prompt: "Rank them." });
    expect(insert).toHaveBeenCalledWith({
      slug: "fast-food-fries",
      title: "Fast Food Fries",
      prompt: "Rank them.",
      created_by: "admin-1",
    });
  });

  it("returns the new id on success", async () => {
    const result = await createTierlist({ slug: "x", title: "X" });
    expect(result).toEqual({ ok: true, id: "new-id" });
  });

  it("maps a unique-violation to taken", async () => {
    single.mockResolvedValue({ data: null, error: { code: "23505" } });
    const result = await createTierlist({ slug: "x", title: "X" });
    expect(result).toEqual({ ok: false, reason: "taken" });
  });
});
