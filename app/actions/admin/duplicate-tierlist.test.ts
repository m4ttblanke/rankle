import { beforeEach, describe, expect, it, vi } from "vitest";

const isCurrentUserAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ isCurrentUserAdmin }));

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const ID = "11111111-1111-4111-8111-111111111111";

const { duplicateTierlist } = await import("./duplicate-tierlist");

beforeEach(() => {
  vi.clearAllMocks();
  isCurrentUserAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ data: { id: "new-id" }, error: null });
});

describe("duplicateTierlist", () => {
  it("rejects a non-admin without calling the RPC", async () => {
    isCurrentUserAdmin.mockResolvedValue(false);
    const result = await duplicateTierlist({ id: ID, newSlug: "copy" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid new slug", async () => {
    const result = await duplicateTierlist({ id: ID, newSlug: "Not Valid!" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls duplicate_tierlist with the right args and returns the new id", async () => {
    const result = await duplicateTierlist({ id: ID, newSlug: "copy" });
    expect(rpc).toHaveBeenCalledWith("duplicate_tierlist", { p_source_id: ID, p_new_slug: "copy" });
    expect(result).toEqual({ ok: true, id: "new-id" });
  });

  it.each([
    ["23505", "taken"],
    ["P0002", "not_found"],
    ["42501", "forbidden"],
    ["40001", "network"],
  ] as const)("maps Postgres code %s to reason %s", async (code, reason) => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    const result = await duplicateTierlist({ id: ID, newSlug: "copy" });
    expect(result).toEqual({ ok: false, reason });
  });
});
