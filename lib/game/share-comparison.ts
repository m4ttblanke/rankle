import { NA_TIER, tierWeight } from "./results";
import type { MyRankingEntry } from "./results-schema";
import type { ShareRankingItem } from "./share-schema";

/**
 * Sender-vs-recipient comparison for the post-play share reveal
 * (Milestone 5's "essential feature is visual side-by-side comparison" —
 * deliberately not a weighted/persistent compatibility score; that stays out
 * of scope, see docs/MANUAL.md sec 19).
 *
 * `same` is a literal same-tier match — including the case where BOTH sides
 * chose N/A. That is NOT an opinion agreement (N/A is "haven't tried," an
 * abstention, not a bad rating — docs/MANUAL.md sec 3), so the UI must label
 * the resulting count literally ("Same placement on N of M"), never
 * "agreed"/"compatibility".
 */

export type ComparisonRow = {
  itemId: string;
  label: string;
  imageUrl: string | null;
  senderTier: string;
  senderPosition: number;
  /** `null` only if the recipient's own ranking is somehow missing this item
   *  — defensive; both rankings are for the same game's fixed item set. */
  myTier: string | null;
  same: boolean;
};

export type ShareComparison = {
  /** Items where BOTH sides gave a scored opinion tier — sorted the way the
   *  sender ranked it (S..F by weight, then position), matching
   *  `ComparisonList`'s convention on `/results`. */
  opinionRows: ComparisonRow[];
  /** Items where EITHER side placed N/A — kept out of the opinion ordering
   *  so N/A never reads as "worse than F" on either side, sorted by the
   *  sender's own position within N/A. */
  naRows: ComparisonRow[];
  samePlacementCount: number;
  totalCount: number;
};

export function compareRankings(
  senderRanking: ShareRankingItem[],
  myRanking: MyRankingEntry[],
  tierConfig: string[],
): ShareComparison {
  const myTierByItem = new Map(myRanking.map((r) => [r.itemId, r.tier]));

  const rows: ComparisonRow[] = senderRanking.map((item) => {
    const myTier = myTierByItem.get(item.itemId) ?? null;
    return {
      itemId: item.itemId,
      label: item.label,
      imageUrl: item.imageUrl,
      senderTier: item.tier,
      senderPosition: item.position,
      myTier,
      same: myTier !== null && myTier === item.tier,
    };
  });

  const opinionRows = rows
    .filter((r) => r.senderTier !== NA_TIER && r.myTier !== NA_TIER)
    .sort((a, b) => {
      const diff = tierWeight(tierConfig, b.senderTier) - tierWeight(tierConfig, a.senderTier);
      return diff !== 0 ? diff : a.senderPosition - b.senderPosition;
    });

  const naRows = rows
    .filter((r) => r.senderTier === NA_TIER || r.myTier === NA_TIER)
    .sort((a, b) => a.senderPosition - b.senderPosition);

  return {
    opinionRows,
    naRows,
    samePlacementCount: rows.filter((r) => r.same).length,
    totalCount: rows.length,
  };
}
