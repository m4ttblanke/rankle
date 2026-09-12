import { redirect } from "next/navigation";
import { ResultsView } from "@/components/results/results-view";
import { AppHeader } from "@/components/layout/app-header";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getGuestId } from "@/lib/game/guest";
import { getResults } from "@/lib/game/get-results";
import { hasSubmittedRanking } from "@/lib/game/submission-state";

/**
 * The community results reveal (Milestone 4).
 *
 * Two independent, server-enforced gates stand between a visitor and any
 * result data — both must pass before anything renders:
 *
 *  1. `hasSubmittedRanking` (app-level, cheap, spoiler-free) — a fast
 *     redirect back to the game for the common case.
 *  2. `getResults` -> `get_results` RPC (the actual authority; SECURITY
 *     DEFINER, raises 42501 until this identity has an official submission).
 *
 * Gate 1 is UX, not authorization: even if it were removed or wrong, gate 2
 * still refuses (docs/SECURITY.md sec 7). A `null` from `getResults` is
 * treated identically whether the cause is "not eligible", "no such game", or
 * a transient failure — the redirect never reveals which. No spoiler-bearing
 * metadata is generated for this route (sharing/OG previews are Milestone 5).
 */
export default async function ResultsPage() {
  const game = await getDailyGame();
  if (!game) redirect("/");

  const guestId = await getGuestId();

  const eligible = await hasSubmittedRanking(game.id, guestId);
  if (!eligible) redirect("/");

  const results = await getResults(game.id, guestId);
  if (!results) redirect("/");

  return (
    <>
      <AppHeader />
      <ResultsView results={results} />
    </>
  );
}
