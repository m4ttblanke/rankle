import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getMyHistory } from "./history";
import { computeStreaks, type StreakSummary } from "./streaks";
import { laDateString } from "./timezone";

/**
 * The current user's streak summary (Milestone 9) — derived fresh on every
 * read from two already-public/owned sources, never a persisted counter:
 *
 *  1. Every publicly-released Rankle's release date — the same
 *     `status in ('scheduled','live','archived') and release_date <= today`
 *     shape as `private.is_tierlist_public()`, applied explicitly here
 *     (rather than solely trusted to RLS) so an admin's own bypassed-RLS
 *     read of `tierlists` can't leak a future/draft date into "released
 *     games" for their own streak.
 *  2. `getMyHistory()` — already unions direct + claimed submissions
 *     (docs/SECURITY.md sec 26), so a guest's claimed history counts here
 *     automatically with no separate logic.
 *
 * Guests get no streak at all (`null`) — deliberately out of scope
 * (docs/TODO.md M9 brief: no fingerprinting/localStorage identity hacks).
 * Any read failure also returns `null` — a stat display, not a trust
 * boundary the rest of the app depends on (same convention as
 * `getMyHistory`/`getResults`/`getShare`).
 */
export async function getMyStreaks(): Promise<StreakSummary | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const today = laDateString(new Date());
    const supabase = await createClient();

    const [{ data: releasedRows, error: releasedErr }, history] = await Promise.all([
      supabase
        .from("tierlists")
        .select("release_date")
        .in("status", ["scheduled", "live", "archived"])
        .not("release_date", "is", null)
        .lte("release_date", today),
      getMyHistory(),
    ]);
    if (releasedErr) throw releasedErr;

    const releaseDates = (releasedRows ?? [])
      .map((r) => r.release_date)
      .filter((d): d is string => d !== null);
    const submittedDates = new Set(
      history.map((h) => h.releaseDate).filter((d): d is string => d !== null),
    );

    return computeStreaks(releaseDates, submittedDates, today);
  } catch (err) {
    console.error("[streaks] getMyStreaks failed", err);
    return null;
  }
}
