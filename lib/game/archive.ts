import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { archiveRowSchema, type ArchiveEntry } from "./archive-schema";
import { getDailyGame } from "./get-daily-game";
import { getMyHistory } from "./history";
import { laDateString } from "./timezone";

/**
 * Read-only browse of every publicly-released Rankle (Milestone 9),
 * newest first. `docs/MANUAL.md` sec 25: "anyone can browse prior topics" —
 * unlike history/streaks, this is intentionally NOT gated on being signed in.
 *
 * Visibility mirrors `private.is_tierlist_public()` exactly
 * (`status in ('scheduled','live','archived') and release_date <= today`),
 * applied explicitly here rather than left to RLS alone: the admin RLS
 * bypass on `tierlists` would otherwise let an admin's own visit to this
 * player-facing page leak drafts/future-scheduled rows, the same class of
 * caller-dependent bug `current_daily_game_id()` was built to close for the
 * homepage (docs/SECURITY.md sec 13). A non-admin caller is already fully
 * protected by RLS regardless of this filter.
 *
 * Played status is intentionally NOT computed per-row:
 *  - Guests get no played/unplayed indicator at all (not even one RPC call
 *    per row) -- no new guest-history infrastructure for this.
 *  - A signed-in user's played status comes from ONE reuse of
 *    `getMyHistory()` (already a small, fixed number of queries covering
 *    direct + claimed submissions), turned into a single slug lookup map --
 *    never one query per archive row.
 */
export async function getArchive(): Promise<ArchiveEntry[]> {
  try {
    const supabase = await createClient();
    const today = laDateString(new Date());

    const [{ data: rows, error }, game, user] = await Promise.all([
      supabase
        .from("tierlists")
        .select("id, slug, title, release_date")
        .in("status", ["scheduled", "live", "archived"])
        .not("release_date", "is", null)
        .lte("release_date", today)
        .order("release_date", { ascending: false }),
      getDailyGame(),
      getCurrentUser(),
    ]);
    if (error) throw error;

    // Signed-in only: one batched read, never one has_submitted_ranking call
    // per archive row (guests never trigger this at all).
    const playedBySlug = new Map<string, string>();
    if (user) {
      const history = await getMyHistory();
      for (const entry of history) {
        playedBySlug.set(entry.tierlistSlug, entry.submissionId);
      }
    }

    return (rows ?? []).map((raw) => {
      const row = archiveRowSchema.parse(raw);
      const submissionId = user ? (playedBySlug.get(row.slug) ?? null) : null;
      return {
        tierlistId: row.id,
        slug: row.slug,
        title: row.title,
        releaseDate: row.release_date,
        isToday: game?.id === row.id,
        played: user ? submissionId !== null : null,
        submissionId,
      };
    });
  } catch (err) {
    console.error("[archive] getArchive failed", err);
    return [];
  }
}
