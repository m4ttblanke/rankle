import type { FriendResultEntry } from "./get-friend-results";
import { opinionTiers, tierWeight } from "./results";
import type { MyRankingEntry, ResultsItem } from "./results-schema";
import { type ComparisonRow, compareRankings } from "./share-comparison";
import type { ShareRankingItem } from "./share-schema";

/**
 * Per-game friend agreement (Milestone 7, docs/MANUAL.md sec 19). Deliberately
 * reuses `compareRankings()` (Milestone 5's sender-vs-recipient comparison)
 * rather than reimplementing row comparison — this module only adds the
 * weighted percentage and "biggest disagreement" pick on top of its
 * `opinionRows` output. Never persisted: computed on read from the two
 * immutable rankings, exactly like `results.ts`'s consensus/controversy.
 */

/**
 * `get_friend_results` deliberately returns only item_id/tier/position (no
 * label/image_url — that would duplicate the game's own item catalog, which
 * the caller already has from `get_results`). Join a friend's bare ranking
 * against that catalog so it can be fed straight into the existing
 * `compareRankings()` without a second comparison implementation.
 */
export function toComparisonInput(
  friendRanking: FriendResultEntry["ranking"],
  items: ResultsItem[],
): ShareRankingItem[] {
  const itemsById = new Map(items.map((i) => [i.itemId, i]));
  return friendRanking
    .map((r) => {
      const item = itemsById.get(r.itemId);
      if (!item) return null;
      return {
        itemId: r.itemId,
        label: item.label,
        imageUrl: item.imageUrl,
        tier: r.tier,
        position: r.position,
      };
    })
    .filter((x): x is ShareRankingItem => x !== null);
}

export type FriendAgreement =
  | { hasSharedRatings: true; agreementPct: number }
  | { hasSharedRatings: false; agreementPct: null };

/**
 * Average, over items where BOTH sides gave a scored (non-N/A) opinion, of
 * `1 - |weightA - weightB| / maxDiff` (maxDiff = the opinion-tier weight
 * range, e.g. 4 for the canonical S..F scale). N/A is excluded entirely by
 * `compareRankings()`'s own `opinionRows` filter — never treated as
 * agreement, never as a numeric opinion. Zero jointly-scored items ->
 * `hasSharedRatings: false` ("Not enough shared ratings" is a UI decision,
 * not encoded here).
 */
export function computeAgreement(
  opinionRows: ComparisonRow[],
  tierConfig: string[],
): FriendAgreement {
  const rows = opinionRows.filter((r) => r.myTier !== null);
  if (rows.length === 0) return { hasSharedRatings: false, agreementPct: null };

  const maxDiff = Math.max(1, opinionTiers(tierConfig).length - 1);
  const total = rows.reduce((sum, row) => {
    const diff = Math.abs(
      tierWeight(tierConfig, row.senderTier) - tierWeight(tierConfig, row.myTier as string),
    );
    return sum + (1 - diff / maxDiff);
  }, 0);

  return { hasSharedRatings: true, agreementPct: Math.round((total / rows.length) * 100) };
}

/**
 * The jointly-scored item with the largest tier-weight difference. `null`
 * when every jointly-scored item matches exactly (nothing meaningfully
 * disagreed on) — a "no notable disagreement" state, not an error.
 */
export function biggestDisagreement(
  opinionRows: ComparisonRow[],
  tierConfig: string[],
): ComparisonRow | null {
  let best: ComparisonRow | null = null;
  let bestDiff = 0;

  for (const row of opinionRows) {
    if (row.myTier === null) continue;
    const diff = Math.abs(
      tierWeight(tierConfig, row.senderTier) - tierWeight(tierConfig, row.myTier),
    );
    if (diff > bestDiff) {
      best = row;
      bestDiff = diff;
    }
  }

  return best;
}

export type FriendComparisonSummary = {
  samePlacementCount: number;
  totalCount: number;
  agreement: FriendAgreement;
  biggestDisagreement: ComparisonRow | null;
};

/** The full per-friend summary a results-page comparison row needs. */
export function summarizeFriendComparison(
  friendRanking: FriendResultEntry["ranking"],
  myRanking: MyRankingEntry[],
  items: ResultsItem[],
  tierConfig: string[],
): FriendComparisonSummary {
  const comparison = compareRankings(toComparisonInput(friendRanking, items), myRanking, tierConfig);
  return {
    samePlacementCount: comparison.samePlacementCount,
    totalCount: comparison.totalCount,
    agreement: computeAgreement(comparison.opinionRows, tierConfig),
    biggestDisagreement: biggestDisagreement(comparison.opinionRows, tierConfig),
  };
}
