import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Magic-link sign-in Server Action (Milestone 6). The redirect target is
 * always this app's own /auth/callback, built from NEXT_PUBLIC_APP_URL —
 * never a client-supplied value.
 */

const signInWithOtp = vi.fn();
const createClient = vi.fn(async () => ({ auth: { signInWithOtp } }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));

const { signInWithMagicLink } = await import("./sign-in");

beforeEach(() => {
  vi.clearAllMocks();
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("signInWithMagicLink — validation", () => {
  it("rejects a malformed email without calling Supabase", async () => {
    const result = await signInWithMagicLink({ email: "not-an-email" });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects an extra top-level field (.strict())", async () => {
    const result = await signInWithMagicLink({
      email: "a@b.com",
      emailRedirectTo: "https://evil.example.com",
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});

describe("signInWithMagicLink — redirect target", () => {
  it("always uses this app's own /auth/callback, never a client-supplied value", async () => {
    await signInWithMagicLink({ email: "matt@rankle.test" });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "matt@rankle.test",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
  });
});

describe("signInWithMagicLink — result mapping", () => {
  it("returns ok on success", async () => {
    const result = await signInWithMagicLink({ email: "matt@rankle.test" });
    expect(result).toEqual({ ok: true });
  });

  it("maps a Supabase error to network, without leaking details", async () => {
    signInWithOtp.mockResolvedValue({ error: { code: "500", message: "db exploded" } });
    const result = await signInWithMagicLink({ email: "matt@rankle.test" });
    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("maps a thrown failure to network", async () => {
    signInWithOtp.mockRejectedValue(new Error("fetch failed"));
    const result = await signInWithMagicLink({ email: "matt@rankle.test" });
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});
