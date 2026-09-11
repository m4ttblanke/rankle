import { redirect } from "next/navigation";
import { NoGameToday } from "@/components/game/empty-state";
import { RankingBoard } from "@/components/game/ranking-board";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getGuestId } from "@/lib/game/guest";
import { hasSubmittedRanking } from "@/lib/game/submission-state";

/**
 * The daily game screen. Resolves today's game via Supabase (RLS enforces
 * release-date + publication) and renders the interactive ranking board, or the
 * empty state when nothing is live.
 *
 * If the current identity already has an official submission for this game,
 * redirect straight to `/results` (Milestone 4) rather than rendering
 * anything here — that check uses the `has_submitted_ranking` RPC, which
 * returns only a boolean, so nothing spoiler-bearing is ever fetched on this
 * route. This redirect is a UX convenience only; `/results` re-checks
 * eligibility itself via the spoiler-gated `get_results` RPC, which is the
 * actual server-enforced boundary (docs/SECURITY.md sec 7).
 */
export default async function HomePage() {
  const game = await getDailyGame();

  if (game) {
    const alreadySubmitted = await hasSubmittedRanking(
      game.id,
      await getGuestId(),
    );
    if (alreadySubmitted) redirect("/results");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Rankle
        </span>
        <span className="text-xs text-muted">Everyone has an opinion.</span>
      </header>

      {game ? (
        <main className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
              {game.title}
            </h1>
            {game.prompt ? (
              <p className="text-sm text-muted sm:text-base">{game.prompt}</p>
            ) : null}
          </div>
          <RankingBoard game={game} />
        </main>
      ) : (
        <main className="flex flex-1 flex-col">
          <NoGameToday />
        </main>
      )}
    </div>
  );
}
