import { createClient } from "@/lib/supabase/server";

/**
 * Has the current identity already submitted an official ranking for this game?
 *
 * Backed by the `has_submitted_ranking` RPC, which returns ONLY a boolean about
 * the caller's own submission — no community aggregates, no ranking contents, so
 * calling it before the spoiler gate opens is safe (docs/SECURITY.md sec 7).
 *
 * Any failure is treated as "not submitted" so the daily game screen still
 * renders (docs/DESIGN.md sec 27) — the database unique index is still the
 * authority that prevents a real double submission.
 *
 * Always calls the RPC, even with `guestId: null` — the RPC itself resolves
 * identity (authenticated session first, guest id only as a fallback when
 * signed out), so a signed-in caller with no guest cookie is still correctly
 * recognized (Milestone 6; a `guestId`-only short-circuit here would
 * incorrectly report "not submitted" for exactly that caller).
 */
export async function hasSubmittedRanking(
  tierlistId: string,
  guestId: string | null,
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("has_submitted_ranking", {
      p_tierlist_id: tierlistId,
      p_guest_id: guestId ?? undefined,
    });
    if (error) {
      console.error(
        `[submission-state] has_submitted_ranking failed game=${tierlistId} code=${error.code ?? "?"}`,
      );
      return false;
    }
    return data === true;
  } catch (err) {
    console.error("[submission-state] has_submitted_ranking threw", err);
    return false;
  }
}
