import { beforeEach, expect, it, vi } from "vitest";

/**
 * `claimGuestSubmissions` (Milestone 6) — the ONLY call site for
 * `claim_guest_submissions()`, which has no PostgREST grant at all. This
 * confirms it goes through the service-role client (never the RLS client)
 * and never throws.
 */

const rpc = vi.fn();
const createServiceRoleClient = vi.fn(() => ({ rpc }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient }));

const { claimGuestSubmissions } = await import("./claim-guest-submissions");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: 2, error: null });
});

it("calls claim_guest_submissions via the service-role client with both ids", async () => {
  const result = await claimGuestSubmissions(USER_ID, GUEST_ID);
  expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("claim_guest_submissions", {
    p_user_id: USER_ID,
    p_guest_id: GUEST_ID,
  });
  expect(result).toBe(2);
});

it("returns 0 (never throws) on an RPC error", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
  expect(await claimGuestSubmissions(USER_ID, GUEST_ID)).toBe(0);
});

it("returns 0 (never throws) on a thrown failure", async () => {
  createServiceRoleClient.mockImplementationOnce(() => {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  });
  expect(await claimGuestSubmissions(USER_ID, GUEST_ID)).toBe(0);
});

it("returns 0 when the RPC reports no newly claimed rows", async () => {
  rpc.mockResolvedValue({ data: 0, error: null });
  expect(await claimGuestSubmissions(USER_ID, GUEST_ID)).toBe(0);
});
