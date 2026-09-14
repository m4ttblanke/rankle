/**
 * Streak derivation (Milestone 9) — pure functions, no Supabase import.
 *
 * A streak is computed, never a persisted counter (docs/TODO.md: "prefer
 * deriving streaks from submission history"). This avoids the two
 * synchronization bugs the M9 brief calls out explicitly: a submission
 * succeeding while a counter fails to increment, and a guest claim not
 * transferring a counter. Since both `releaseDates` and `submittedDates`
 * below are themselves derived fresh from the database on every read (see
 * `get-streaks.ts`), there is nothing to keep in sync.
 *
 * "Streak" means consecutive OFFICIALLY RELEASED Rankles the player
 * completed — not consecutive calendar days. A day with no released game is
 * simply absent from `releaseDates` and cannot break anything (docs/MANUAL.md
 * sec 15's own Mon/Tue/Thu example).
 */

export type StreakSummary = {
  current: number;
  longest: number;
  totalPlayed: number;
};

/**
 * @param releaseDates Every publicly-released Rankle's release date
 *   ("YYYY-MM-DD"), any order, duplicates ignored. Drafts and future
 *   scheduled games must already be excluded by the caller (they're not
 *   "released").
 * @param submittedDates The dates (matching entries in `releaseDates`) on
 *   which this identity (direct or claimed) submitted an official ranking.
 *   Tier values don't matter — an N/A-only ranking still counts, since a
 *   submission row exists regardless of what it contains.
 * @param today "YYYY-MM-DD" in the canonical timezone. Only used for the
 *   one special case: if the single most-recently-released game is today's
 *   and the player hasn't submitted it yet, it must not break the streak —
 *   they still have time.
 */
export function computeStreaks(
  releaseDates: readonly string[],
  submittedDates: ReadonlySet<string>,
  today: string,
): StreakSummary {
  const distinct = Array.from(new Set(releaseDates)).sort(); // ascending
  if (distinct.length === 0) {
    return { current: 0, longest: 0, totalPlayed: 0 };
  }

  // run[i] = length of the consecutive-submitted run ending at distinct[i]
  // (0 if distinct[i] itself was not submitted). A gap of any kind — missed
  // release, whatever the calendar distance — resets it to 0, which is
  // exactly "define streaks by release sequence, not raw calendar days."
  const run: number[] = new Array(distinct.length);
  let totalPlayed = 0;
  for (let i = 0; i < distinct.length; i++) {
    const played = submittedDates.has(distinct[i]);
    if (played) totalPlayed++;
    run[i] = played ? (i > 0 ? run[i - 1] : 0) + 1 : 0;
  }

  const longest = Math.max(0, ...run);

  const lastIndex = distinct.length - 1;
  const lastIsUnplayedToday =
    distinct[lastIndex] === today && !submittedDates.has(distinct[lastIndex]);

  // Today's still-open, not-yet-submitted game doesn't count against the
  // streak (they still have a chance) -- but it also doesn't extend it yet.
  // Fall back to the run as of the day before.
  const current = lastIsUnplayedToday ? (lastIndex > 0 ? run[lastIndex - 1] : 0) : run[lastIndex];

  return { current, longest, totalPlayed };
}
