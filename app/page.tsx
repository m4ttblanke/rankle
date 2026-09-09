import { NoGameToday } from "@/components/game/empty-state";
import { TierBoard } from "@/components/game/tier-board";
import { getDailyGame } from "@/lib/game/get-daily-game";

/**
 * The daily game screen. Milestone 1: resolves today's game via Supabase (RLS
 * enforces release-date + publication) and renders it as a read-only tier board,
 * or the empty state when nothing is live. No community/results/share data is
 * fetched here — that stays behind the post-submission spoiler gate
 * (docs/SECURITY.md sec 7).
 */
export default async function HomePage() {
  const game = await getDailyGame();

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
          <TierBoard game={game} />
        </main>
      ) : (
        <main className="flex flex-1 flex-col">
          <NoGameToday />
        </main>
      )}
    </div>
  );
}
