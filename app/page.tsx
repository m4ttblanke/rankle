import { redirect } from "next/navigation";
import { NoGameToday } from "@/components/game/empty-state";
import { RankingBoard } from "@/components/game/ranking-board";
import { AppHeader } from "@/components/layout/app-header";
import { logAnalyticsEvent } from "@/lib/analytics/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getFriendPlayedStatus } from "@/lib/game/friends";
import { getGuestId } from "@/lib/game/guest";
import { getShare } from "@/lib/game/get-share";
import { getMyStreaks } from "@/lib/game/get-streaks";
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

  const guestId = await getGuestId();

  if (game) {
    const alreadySubmitted = await hasSubmittedRanking(game.id, guestId);
    if (alreadySubmitted) {
      redirect(shareToken ? `/share/${shareToken}` : "/results");
    }
  }

  const user = await getCurrentUser();

  // `daily_game_viewed` (Product Analytics milestone, docs/TODO.md): fires
  // only for the population that actually reaches the interactive board
  // below — a real current game, and an identity that has NOT already
  // submitted (the branch above already redirected those visitors away
  // before this line). Logged server-side, once per request — no client
  // round trip needed.
  if (game) {
    await logAnalyticsEvent({
      eventName: "daily_game_viewed",
      tierlistId: game.id,
      userId: user?.id ?? null,
      guestId: user ? null : guestId,
      properties: {
        authenticated: Boolean(user),
        entry_source: shareToken ? "share" : "direct",
        item_count: game.items.length,
      },
    });
  }

  // Spoiler-safe, pre-submission friend activity count (docs/MANUAL.md sec
  // 17: "5 friends played today" — a count only, never who or what they
  // ranked). Account-only and only worth a fetch when there's a game to ask
  // about; a signed-out visitor never triggers this call at all.
  const friendsPlayedCount =
    game && user ? (await getFriendPlayedStatus(game.id)).filter((f) => f.played).length : null;

  // A light pre-submission nudge for a signed-in player with an active
  // streak — never a "0 streak" flex before their first game (docs/TODO.md
  // M9 brief). The full streak + countdown reveal lives on `/results`.
  const streak = user ? await getMyStreaks() : null;

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        {game ? (
          <main className="flex flex-1 flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
                {game.title}
              </h1>
              {game.prompt ? (
                <p className="text-sm text-muted sm:text-base">{game.prompt}</p>
              ) : null}
              {friendsPlayedCount ? (
                <p className="text-xs font-medium text-muted">
                  {friendsPlayedCount} friend{friendsPlayedCount === 1 ? "" : "s"} played today
                </p>
              ) : null}
              {streak && streak.current > 0 ? (
                <p className="text-xs font-medium text-muted">
                  🔥 {streak.current} Rankle{streak.current === 1 ? "" : "s"} in a row
                </p>
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
    </>
  );
}
