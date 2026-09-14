import { describe, expect, it } from "vitest";
import { computeCountdown, formatRemaining } from "./countdown";
import { laMidnightUtc } from "./timezone";

describe("computeCountdown", () => {
  it("no scheduled release -> none, and never implies a date", () => {
    expect(computeCountdown(null, new Date("2026-09-12T18:00:00Z"))).toEqual({ kind: "none" });
  });

  it("release is tomorrow (LA calendar day) -> tomorrow, with the exact LA-midnight target instant", () => {
    // 2026-09-12T18:00:00Z is 2026-09-12 11:00 in LA (PDT, -7) -- today is
    // 09-12, so tomorrow is 09-13.
    const state = computeCountdown("2026-09-13", new Date("2026-09-12T18:00:00Z"));
    expect(state).toEqual({
      kind: "tomorrow",
      targetInstant: laMidnightUtc("2026-09-13").toISOString(),
    });
  });

  it("release is later than tomorrow -> later, with the honest date (no implied daily release)", () => {
    const state = computeCountdown("2026-09-20", new Date("2026-09-12T18:00:00Z"));
    expect(state).toEqual({ kind: "later", releaseDate: "2026-09-20" });
  });

  it("respects LA calendar boundaries, not UTC ones, when deciding 'tomorrow'", () => {
    // 2026-09-13T02:00:00Z is still 2026-09-12 19:00 in LA (PDT) -- UTC's
    // calendar day has already flipped to 09-13, but LA's hasn't, so LA
    // "tomorrow" is still 09-13, not 09-14.
    const now = new Date("2026-09-13T02:00:00Z");
    expect(computeCountdown("2026-09-13", now).kind).toBe("tomorrow");
    expect(computeCountdown("2026-09-14", now).kind).toBe("later");
  });

  it("is DST-safe across the spring-forward boundary", () => {
    // LA "today" = 2026-03-08 (the transition day itself); tomorrow's
    // midnight must land on the correct post-transition UTC instant.
    const now = laMidnightUtc("2026-03-08");
    const state = computeCountdown("2026-03-09", now);
    expect(state).toEqual({
      kind: "tomorrow",
      targetInstant: laMidnightUtc("2026-03-09").toISOString(),
    });
  });
});

describe("formatRemaining", () => {
  it("formats hours and minutes", () => {
    expect(formatRemaining(8 * 3_600_000 + 42 * 60_000)).toBe("8h 42m");
  });

  it("formats whole hours with no minutes", () => {
    expect(formatRemaining(3 * 3_600_000)).toBe("3h");
  });

  it("formats minutes only under an hour", () => {
    expect(formatRemaining(42 * 60_000)).toBe("42m");
  });

  it("never shows a negative or zero duration", () => {
    expect(formatRemaining(0)).toBe("Any minute now");
    expect(formatRemaining(-5_000)).toBe("Any minute now");
  });
});
