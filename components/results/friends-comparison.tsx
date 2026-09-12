import { tierStyle } from "@/components/game/tier-style";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import { summarizeFriendComparison } from "@/lib/game/friend-compatibility";
import type { FriendResultEntry } from "@/lib/game/get-friend-results";
import type { GameResults } from "@/lib/game/results-schema";

/**
 * The `/results` Friends section (Milestone 7) — appears only for a
 * signed-in caller (the page passes `null` for a guest, which
 * `ResultsView` uses to skip this section entirely; see
 * `app/results/page.tsx`). `friends` already reflects the full access rule
 * (current friends who ALSO submitted this game) via `get_friend_results`,
 * so every row here is safe to render as-is — no further filtering needed.
 *
 * Per-friend agreement is computed here, on read, from the two immutable
 * rankings (`summarizeFriendComparison` — reuses the M5 `compareRankings`
 * comparison, never persisted). "Same placement" is a literal count
 * (including a shared N/A); the percentage is the weighted opinion-only
 * agreement (N/A excluded) — both labeled honestly, never conflated.
 */
export function FriendsComparison({
  friends,
  results,
}: {
  friends: FriendResultEntry[];
  results: GameResults;
}) {
  if (friends.length === 0) {
    return <p className="text-sm text-muted">No friends have played today’s Rankle yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {friends.map((friend) => {
        const summary = summarizeFriendComparison(
          friend.ranking,
          results.myRanking,
          results.items,
          results.tierlist.tierConfig,
        );
        const disagreement = summary.biggestDisagreement;
        const myStyle = disagreement ? tierStyle(disagreement.myTier ?? "") : null;
        const theirStyle = disagreement ? tierStyle(disagreement.senderTier) : null;

        return (
          <li
            key={friend.user.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center gap-3">
              <AvatarPlaceholder name={friend.user.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {friend.user.displayName}
                </p>
                <p className="truncate text-xs text-muted">
                  Same placement on {summary.samePlacementCount} of {summary.totalCount}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-lg font-extrabold leading-none text-foreground">
                  {summary.agreement.hasSharedRatings ? `${summary.agreement.agreementPct}%` : "—"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {summary.agreement.hasSharedRatings ? "agreement today" : "not enough shared ratings"}
                </p>
              </div>
            </div>
            {disagreement && myStyle && theirStyle ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>Biggest disagreement — {disagreement.label}:</span>
                <span
                  title={`You: ${disagreement.myTier}`}
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 font-display text-xs font-extrabold ${myStyle.chip}`}
                >
                  {disagreement.myTier}
                </span>
                <span
                  title={`${friend.user.displayName}: ${disagreement.senderTier}`}
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 font-display text-xs font-extrabold ${theirStyle.chip}`}
                >
                  {disagreement.senderTier}
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
