import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one client-reachable analytics boundary (Product Analytics milestone,
 * docs/TODO.md). Identity must come only from trusted server state
 * (`auth.getUser()` / a read-only `getGuestId()`), never from the request
 * body — same discipline as every other Server Action in this codebase — and
 * only the two client-loggable event names may ever reach `logAnalyticsEvent`
 * through here.
 */

const getGuestId = vi.fn();
vi.mock("@/lib/game/guest", () => ({ getGuestId }));

const getUser = vi.fn();
const createClient = vi.fn(async () => ({ auth: { getUser } }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const logAnalyticsEvent = vi.fn();
vi.mock("@/lib/analytics/log", () => ({ logAnalyticsEvent }));

const { logEvent } = await import("./log-event");

const GAME_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  getGuestId.mockResolvedValue(GUEST_ID);
  logAnalyticsEvent.mockResolvedValue(undefined);
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "ranking_started",
    tierlistId: GAME_ID,
    entrySource: "direct",
    ...overrides,
  };
}

describe("logEvent — validation", () => {
  it("rejects a malformed payload without ever resolving identity", async () => {
    await logEvent({ eventName: "ranking_started", tierlistId: "not-a-uuid" });
    expect(createClient).not.toHaveBeenCalled();
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("rejects any event name outside the client-loggable allowlist — a client cannot forge ranking_submitted", async () => {
    await logEvent(validInput({ eventName: "ranking_submitted" }));
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("rejects share_recipient_submitted the same way", async () => {
    await logEvent(validInput({ eventName: "share_recipient_submitted" }));
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("an extra top-level field is rejected outright (.strict())", async () => {
    await logEvent(validInput({ userId: "attacker-supplied-id" }));
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });
});

describe("logEvent — identity", () => {
  it("a signed-out caller's identity comes from getGuestId() (read-only — never mints a cookie)", async () => {
    await logEvent(validInput());
    expect(getGuestId).toHaveBeenCalled();
    expect(logAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, guestId: GUEST_ID }),
    );
  });

  it("a signed-in caller never reads/sends a guest id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    await logEvent(validInput());
    expect(getGuestId).not.toHaveBeenCalled();
    expect(logAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, guestId: null }),
    );
  });

  it("a guestId smuggled onto the payload is rejected, not forwarded", async () => {
    await logEvent(validInput({ guestId: "should-be-ignored" }));
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });
});

describe("logEvent — never breaks the caller", () => {
  it("an identity-resolution failure resolves normally, not a rejection", async () => {
    getUser.mockRejectedValue(new Error("auth unavailable"));
    await expect(logEvent(validInput())).resolves.toBeUndefined();
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("a logAnalyticsEvent failure resolves normally, not a rejection", async () => {
    logAnalyticsEvent.mockRejectedValue(new Error("insert failed"));
    await expect(logEvent(validInput())).resolves.toBeUndefined();
  });
});
