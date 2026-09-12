import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Profile edit Server Action (Milestone 6). A plain RLS-gated UPDATE — no
 * RPC. Validation mirrors the database's own username/display-name
 * constraints.
 */

const getUser = vi.fn();
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
const createClient = vi.fn(async () => ({ auth: { getUser }, from }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { updateProfile } = await import("./update-profile");

const USER_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  eq.mockResolvedValue({ error: null });
});

describe("updateProfile — validation (mirrors DB constraints)", () => {
  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(21)],
    ["invalid characters", "matt-b!"],
  ])("rejects username: %s", async (_name, username) => {
    const result = await updateProfile({ username, displayName: "Matt" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("lowercases a valid mixed-case username before writing (canonical form)", async () => {
    await updateProfile({ username: "MattB_1", displayName: "Matt" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ username: "mattb_1" }),
    );
  });

  it("rejects an empty display name", async () => {
    const result = await updateProfile({ username: "mattb", displayName: "" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a display name over 50 chars", async () => {
    const result = await updateProfile({
      username: "mattb",
      displayName: "a".repeat(51),
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an extra top-level field, e.g. a spoofed is_admin (.strict())", async () => {
    const result = await updateProfile({
      username: "mattb",
      displayName: "Matt",
      is_admin: true,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateProfile — authorization", () => {
  it("only ever updates the caller's own row (RLS is authoritative; this is defense in depth)", async () => {
    await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("refuses when signed out, without touching the database", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateProfile — result mapping", () => {
  it("returns ok on success and revalidates /profile so the change is visible", async () => {
    const result = await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("maps a unique-violation to 'taken'", async () => {
    eq.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const result = await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(result).toEqual({ ok: false, reason: "taken" });
  });

  it("maps any other database error to network, without leaking details", async () => {
    eq.mockResolvedValue({ error: { code: "42501", message: "policy detail" } });
    const result = await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("maps a thrown failure to network", async () => {
    getUser.mockRejectedValue(new Error("auth unavailable"));
    const result = await updateProfile({ username: "mattb", displayName: "Matt" });
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});
