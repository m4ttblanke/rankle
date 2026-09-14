/**
 * The only place this app computes calendar dates in the canonical
 * `America/Los_Angeles` timezone from application (non-database) code.
 *
 * Every gameplay-authoritative "what day is it" decision still happens in
 * Postgres (`private.today()`) — these helpers exist solely for M9's
 * countdown display, which needs to turn a bare `release_date` (already
 * resolved server-side by `get_next_release_date()`) into a concrete UTC
 * instant a client can count down to, without the browser's own timezone
 * changing which Rankle boundary is being represented.
 *
 * DST-safe by construction: `laWallClockAsUtcMillis` reads Los Angeles's
 * actual wall-clock reading for a given instant via `Intl.DateTimeFormat`
 * (which has full IANA tz + DST data), so `laMidnightUtc` converges on the
 * correct instant by fixed-point iteration rather than assuming a fixed
 * UTC offset — it produces the right answer on both DST transition days,
 * where a fixed -7/-8 assumption would be off by an hour.
 */

export const APP_TIMEZONE = "America/Los_Angeles";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function laWallClockAsUtcMillis(instant: Date): number {
  const parts = dateFormatter.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
}

/** "YYYY-MM-DD" calendar date in `America/Los_Angeles` for a given instant. */
export function laDateString(instant: Date): string {
  const parts = dateFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Add `days` (may be negative) to a "YYYY-MM-DD" calendar date string. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
    next.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * The UTC instant at which `America/Los_Angeles` local time reaches
 * `00:00:00` on the given "YYYY-MM-DD" calendar date. Correct across DST
 * transitions: converges by fixed-point iteration on the actual instant
 * whose LA wall-clock reading equals the target midnight, rather than
 * applying a single assumed offset for the whole day.
 */
export function laMidnightUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetWallMs = Date.UTC(y, m - 1, d, 0, 0, 0);

  let guessMs = targetWallMs; // first guess: assume UTC == LA (0 offset)
  for (let i = 0; i < 4; i++) {
    const wallAtGuess = laWallClockAsUtcMillis(new Date(guessMs));
    const diff = targetWallMs - wallAtGuess;
    if (diff === 0) break;
    guessMs += diff;
  }
  return new Date(guessMs);
}
