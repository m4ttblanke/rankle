import { addDaysToDateString, laDateString, laMidnightUtc } from "./timezone";

/**
 * The three cases the M9 brief requires the UI to distinguish, computed
 * purely from `nextReleaseDate` (already the ONLY thing
 * `get_next_release_date()` exposes) and the current instant — no game
 * title/slug/topic ever passes through here.
 */
export type CountdownState =
  | { kind: "tomorrow"; targetInstant: string } // ISO instant to count down to
  | { kind: "later"; releaseDate: string } // e.g. "2026-09-20" -- shown as a date, not a countdown
  | { kind: "none" };

/**
 * @param nextReleaseDate "YYYY-MM-DD" from `get_next_release_date()`, or
 *   `null` when nothing is scheduled.
 * @param now The current instant — always injected, never read internally,
 *   so this stays testable without a fragile real-clock dependency
 *   (docs/TODO.md M9 testing guidance).
 */
export function computeCountdown(nextReleaseDate: string | null, now: Date): CountdownState {
  if (!nextReleaseDate) return { kind: "none" };

  const today = laDateString(now);
  const tomorrow = addDaysToDateString(today, 1);

  if (nextReleaseDate === tomorrow) {
    return { kind: "tomorrow", targetInstant: laMidnightUtc(nextReleaseDate).toISOString() };
  }

  // Defensive: get_next_release_date() guarantees release_date > today(), so
  // this covers "later than tomorrow" honestly rather than implying a daily
  // release that isn't actually scheduled -- and also degrades sanely for
  // any earlier-than-expected date reaching here instead of counting down.
  return { kind: "later", releaseDate: nextReleaseDate };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "8h 42m" / "42m" / "Any minute now" — minute resolution (no seconds tick;
 *  docs/DESIGN.md sec 21: avoid decorative/constant motion). */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Any minute now";
  const hours = Math.floor(remainingMs / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS) || (hours === 0 ? 1 : 0);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
