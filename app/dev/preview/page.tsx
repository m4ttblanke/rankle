import { notFound } from "next/navigation";
import { TierBoard } from "@/components/game/tier-board";
import { SAMPLE_DAILY_GAME } from "@/lib/game/fixtures";

/**
 * Dev-only preview of the read-only tier board with sample data, for visual
 * review and e2e tests. Returns 404 in production builds — it is not a product
 * route and never reads a database.
 */
export const dynamic = "force-static";

export default function TierBoardPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const game = SAMPLE_DAILY_GAME;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Rankle
        </span>
        <span className="text-xs text-muted">preview</span>
      </header>
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
    </div>
  );
}
