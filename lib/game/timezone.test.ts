import { describe, expect, it } from "vitest";
import { addDaysToDateString, laDateString, laMidnightUtc } from "./timezone";

describe("laMidnightUtc", () => {
  it("converts an ordinary winter (PST, UTC-8) date correctly", () => {
    // 2026-01-15 00:00:00 America/Los_Angeles = 2026-01-15 08:00:00 UTC
    expect(laMidnightUtc("2026-01-15").toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("converts an ordinary summer (PDT, UTC-7) date correctly", () => {
    // 2026-07-15 00:00:00 America/Los_Angeles = 2026-07-15 07:00:00 UTC
    expect(laMidnightUtc("2026-07-15").toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("handles the US spring-forward transition (2026-03-08): midnight is still PST", () => {
    // Clocks jump 2:00am -> 3:00am on 2026-03-08, so midnight that day is
    // still standard time (-8), not the offset that applies later that day.
    expect(laMidnightUtc("2026-03-08").toISOString()).toBe("2026-03-08T08:00:00.000Z");
    // The very next day is fully in daylight time (-7).
    expect(laMidnightUtc("2026-03-09").toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  it("handles the US fall-back transition (2026-11-01): midnight is still PDT", () => {
    // Clocks fall back 2:00am -> 1:00am on 2026-11-01, so midnight that day
    // is still daylight time (-7), not the standard time that applies later.
    expect(laMidnightUtc("2026-11-01").toISOString()).toBe("2026-11-01T07:00:00.000Z");
    // The very next day is fully in standard time (-8).
    expect(laMidnightUtc("2026-11-02").toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });
});

describe("laDateString", () => {
  it("reads back the same date laMidnightUtc produced, across DST boundaries", () => {
    for (const d of ["2026-01-15", "2026-03-08", "2026-03-09", "2026-07-15", "2026-11-01", "2026-11-02"]) {
      expect(laDateString(laMidnightUtc(d))).toBe(d);
    }
  });

  it("reads a known instant back correctly", () => {
    // 2026-07-15T07:00:00Z is exactly LA midnight in summer.
    expect(laDateString(new Date("2026-07-15T07:00:00.000Z"))).toBe("2026-07-15");
    // One second earlier is still the previous LA calendar day.
    expect(laDateString(new Date("2026-07-15T06:59:59.000Z"))).toBe("2026-07-14");
  });
});

describe("addDaysToDateString", () => {
  it("adds and subtracts days across month/year boundaries", () => {
    expect(addDaysToDateString("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("is unaffected by DST transitions (pure calendar-date arithmetic)", () => {
    expect(addDaysToDateString("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToDateString("2026-11-01", 1)).toBe("2026-11-02");
  });
});
