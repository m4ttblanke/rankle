import { describe, expect, it } from "vitest";
import { computeStreaks } from "./streaks";

const set = (...dates: string[]) => new Set(dates);

describe("computeStreaks", () => {
  it("no submissions at all -> 0/0/0", () => {
    expect(computeStreaks(["2026-09-01", "2026-09-02"], set(), "2026-09-03")).toEqual({
      current: 0,
      longest: 0,
      totalPlayed: 0,
    });
  });

  it("no released games at all -> 0/0/0", () => {
    expect(computeStreaks([], set(), "2026-09-03")).toEqual({ current: 0, longest: 0, totalPlayed: 0 });
  });

  it("first completed Rankle -> current 1, longest 1, total 1", () => {
    expect(computeStreaks(["2026-09-01"], set("2026-09-01"), "2026-09-01")).toEqual({
      current: 1,
      longest: 1,
      totalPlayed: 1,
    });
  });

  it("consecutive released Rankles all played -> increments each day", () => {
    const releases = ["2026-09-01", "2026-09-02", "2026-09-03"];
    expect(computeStreaks(releases, set(...releases), "2026-09-03")).toEqual({
      current: 3,
      longest: 3,
      totalPlayed: 3,
    });
  });

  it("a scheduling gap (no game released) does not break the streak", () => {
    // Mon/Tue/Thu example from docs/MANUAL.md sec 15 -- Wednesday has no
    // release at all, so it's simply absent from releaseDates.
    const releases = ["2026-09-07", "2026-09-08", "2026-09-10"]; // Mon, Tue, Thu
    const submitted = set("2026-09-07", "2026-09-08", "2026-09-10");
    expect(computeStreaks(releases, submitted, "2026-09-10")).toEqual({
      current: 3,
      longest: 3,
      totalPlayed: 3,
    });
  });

  it("missing an actual released Rankle resets the current streak, longest survives", () => {
    const releases = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
    // played Mon+Tue, missed Wed (a real release that existed), played Thu
    const submitted = set("2026-09-01", "2026-09-02", "2026-09-04");
    expect(computeStreaks(releases, submitted, "2026-09-04")).toEqual({
      current: 1, // only today (Thu) counts toward the current run
      longest: 2, // Mon+Tue is still the longest run on record
      totalPlayed: 3,
    });
  });

  it("today's game exists but is not yet submitted: does not break the streak", () => {
    const releases = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const submitted = set("2026-09-01", "2026-09-02"); // today (09-03) not yet played
    expect(computeStreaks(releases, submitted, "2026-09-03")).toEqual({
      current: 2, // preserved from before today, not reset to 0
      longest: 2,
      totalPlayed: 2,
    });
  });

  it("today's game is submitted: extends the streak through today", () => {
    const releases = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const submitted = set("2026-09-01", "2026-09-02", "2026-09-03");
    expect(computeStreaks(releases, submitted, "2026-09-03").current).toBe(3);
  });

  it("the most recent release is NOT today (an actual miss, not a pending chance) -> current resets to 0", () => {
    // last release was yesterday and unplayed; "today" has no released game.
    const releases = ["2026-09-01", "2026-09-02"];
    const submitted = set("2026-09-01");
    expect(computeStreaks(releases, submitted, "2026-09-03")).toEqual({
      current: 0,
      longest: 1,
      totalPlayed: 1,
    });
  });

  it("longest streak is the maximum run anywhere in history, independent of current", () => {
    const releases = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
    // played 01,02,03 (run of 3), missed 04, played 05 (current run of 1)
    const submitted = set("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05");
    expect(computeStreaks(releases, submitted, "2026-09-05")).toEqual({
      current: 1,
      longest: 3,
      totalPlayed: 4,
    });
  });

  it("N/A-only rankings still count -- submission existence is all that matters, not tier content", () => {
    // computeStreaks only ever sees "was this date submitted," so an N/A-only
    // submission is indistinguishable from any other -- this test documents
    // that the function has no tier-aware logic to accidentally exclude it.
    expect(computeStreaks(["2026-09-01"], set("2026-09-01"), "2026-09-01").current).toBe(1);
  });

  it("duplicate entries in either input cannot inflate the streak", () => {
    const releases = ["2026-09-01", "2026-09-01", "2026-09-02"];
    const submitted = set("2026-09-01", "2026-09-02");
    expect(computeStreaks(releases, submitted, "2026-09-02")).toEqual({
      current: 2,
      longest: 2,
      totalPlayed: 2,
    });
  });

  it("a submitted date with no matching released game is simply not counted (defensive)", () => {
    // Shouldn't happen in practice (a submission can only exist for a game
    // that was once current, i.e. always in the public released set), but
    // computeStreaks must not let an unmatched date inflate totals.
    const releases = ["2026-09-01"];
    const submitted = set("2026-09-01", "2099-01-01");
    expect(computeStreaks(releases, submitted, "2026-09-01")).toEqual({
      current: 1,
      longest: 1,
      totalPlayed: 1,
    });
  });
});
