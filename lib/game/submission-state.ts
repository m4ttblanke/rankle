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
 */
export async function hasSubmittedRanking(
  tierlistId: string,
  guestId: string | null,
): Promise<boolean> {
  // Milestone 3 has no authentication, so no guest cookie means no prior
  // submission and there is nothing to ask the database. Revisit this
  // short-circuit when signed-in users exist (they have identity without a
  // guest cookie).
  if (!guestId) return false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("has_submitted_ranking", {
      p_tierlist_id: tierlistId,
      p_guest_id: guestId,
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
