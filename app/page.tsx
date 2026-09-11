import { redirect } from "next/navigation";
import { NoGameToday } from "@/components/game/empty-state";
import { RankingBoard } from "@/components/game/ranking-board";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getGuestId } from "@/lib/game/guest";
import { getShare } from "@/lib/game/get-share";
import { shareTokenSchema } from "@/lib/game/share-schema";
import { hasSubmittedRanking } from "@/lib/game/submission-state";

type Props = { searchParams: Promise<{ share?: string | string[] }> };

/**
 * Resolve an optional `?share=<token>` continuation param (Milestone 5) into
 * a token this game screen is allowed to carry forward, or `null`.
 *
 * Deliberately narrow — this is NOT a general returnTo/open-redirect system.
 * The only destination ever produced from this is `/share/${token}`, built
 * internally by `RankingBoard`/`SubmitBar`, never a client-supplied URL. A
 * token is carried forward only when it (1) matches the share-token shape
 * and (2) actually corresponds to TODAY's live game — an old/foreign token
 * is dropped here, before it ever reaches the submission UI, so it cannot
 * alter what gets submitted or redirect a fresh player somewhere unrelated.
 *
 * (2) is checked by calling `getShare(token, null)` — deliberately passing
 * `null` as the guest id rather than this visitor's real cookie value, so
 * this lookup only ever asks "what game does this token represent," never
 * "is this specific visitor eligible for it." `get_share` itself remains the
 * one place that decides eligibility (docs/SECURITY.md sec 7, sec 8): for any
 * identity this call doesn't happen to unlock, it returns `locked: true` /
 * `ranking: null`, same as it would for anyone else. Whatever this call
 * returns is used ONLY to compare `tierlistSlug` against today's game — the
 * result is never serialized into a prop, rendered, or otherwise passed into
 * the gameplay UI below. (Today, with no sign-in flow yet, a null-guest
 * unauthenticated caller can in fact never satisfy `get_share`'s eligibility
 * check either — but that is a property of the current identity model, not
 * something this function relies on or that stays true once authenticated
 * sessions exist.)
 */
async function resolveShareContinuation(
  raw: string | string[] | undefined,
  todaySlug: string | undefined,
): Promise<string | null> {
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || !todaySlug) return null;
  if (!shareTokenSchema.safeParse(token).success) return null;

  const share = await getShare(token, null);
  if (!share || share.tierlistSlug !== todaySlug) return null;

  return token;
}

/**
 * The daily game screen. Resolves today's game via Supabase (RLS enforces
 * release-date + publication) and renders the interactive ranking board, or the
 * empty state when nothing is live.
 *
 * If the current identity already has an official submission for this game,
 * redirect straight to `/results` (Milestone 4) — or, when a validated
 * `?share=` continuation is present, to `/share/[token]` instead (Milestone
 * 5), rather than rendering anything here. That check uses the
 * `has_submitted_ranking` RPC, which returns only a boolean, so nothing
 * spoiler-bearing is ever fetched on this route. This redirect is a UX
 * convenience only; the destination route re-checks eligibility itself, which
 * is the actual server-enforced boundary (docs/SECURITY.md sec 7).
 */
export default async function HomePage({ searchParams }: Props) {
  const game = await getDailyGame();
  const { share: shareParam } = await searchParams;
  const shareToken = await resolveShareContinuation(shareParam, game?.slug);

  if (game) {
    const alreadySubmitted = await hasSubmittedRanking(
      game.id,
      await getGuestId(),
    );
    if (alreadySubmitted) {
      redirect(shareToken ? `/share/${shareToken}` : "/results");
    }
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
          <RankingBoard game={game} shareToken={shareToken} />
        </main>
      ) : (
        <main className="flex flex-1 flex-col">
          <NoGameToday />
        </main>
      )}
    </div>
  );
}
