import { describe, expect, it } from "vitest";
import {
  biggestDisagreement,
  computeAgreement,
  summarizeFriendComparison,
  toComparisonInput,
} from "./friend-compatibility";
import { compareRankings } from "./share-comparison";
import type { MyRankingEntry, ResultsItem } from "./results-schema";
import type { FriendResultEntry } from "./get-friend-results";

const TIER_CONFIG = ["S", "A", "B", "C", "F", "N/A"];

function item(overrides: Partial<ResultsItem> = {}): ResultsItem {
  return {
    itemId: "item-a",
    label: "Item A",
    imageUrl: null,
    sortOrder: 0,
    tierCounts: {},
    n: 0,
    sumWeight: 0,
    avgWeight: null,
    ...overrides,
  };
}

describe("toComparisonInput", () => {
  it("joins a friend's bare ranking against the game's item catalog", () => {
    const friendRanking: FriendResultEntry["ranking"] = [
      { itemId: "a", tier: "S", position: 0 },
    ];
    const items = [item({ itemId: "a", label: "Item A", imageUrl: "img.png" })];
    const result = toComparisonInput(friendRanking, items);
    expect(result).toEqual([
      { itemId: "a", label: "Item A", imageUrl: "img.png", tier: "S", position: 0 },
    ]);
  });

  it("drops a ranking entry for an item not in the catalog (defensive only)", () => {
    const friendRanking: FriendResultEntry["ranking"] = [
      { itemId: "unknown", tier: "S", position: 0 },
    ];
    expect(toComparisonInput(friendRanking, [])).toEqual([]);
  });
});

describe("computeAgreement", () => {
  it("identical opinion tiers on every jointly-scored item -> 100%", () => {
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "S", position: 0 }];
    const rows = compareRankings(
      toComparisonInput([{ itemId: "a", tier: "S", position: 0 }], [item({ itemId: "a" })]),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    expect(computeAgreement(rows, TIER_CONFIG)).toEqual({
      hasSharedRatings: true,
      agreementPct: 100,
    });
  });

  it("maximum possible disagreement (S vs F, the two extremes) -> 0%", () => {
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "F", position: 0 }];
    const rows = compareRankings(
      toComparisonInput([{ itemId: "a", tier: "S", position: 0 }], [item({ itemId: "a" })]),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    expect(computeAgreement(rows, TIER_CONFIG)).toEqual({
      hasSharedRatings: true,
      agreementPct: 0,
    });
  });

  it("a mixed set of tiers produces the expected averaged percentage", () => {
    // S vs A: weights 6 vs 5, diff 1, maxDiff 4 -> agreement 0.75
    // F vs F: diff 0 -> agreement 1.0
    // average -> 0.875 -> rounds to 88%
    const mine: MyRankingEntry[] = [
      { itemId: "a", tier: "A", position: 0 },
      { itemId: "b", tier: "F", position: 0 },
    ];
    const items = [item({ itemId: "a" }), item({ itemId: "b", label: "Item B" })];
    const rows = compareRankings(
      toComparisonInput(
        [
          { itemId: "a", tier: "S", position: 0 },
          { itemId: "b", tier: "F", position: 0 },
        ],
        items,
      ),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    expect(computeAgreement(rows, TIER_CONFIG)).toEqual({
      hasSharedRatings: true,
      agreementPct: 88,
    });
  });

  it("N/A is excluded entirely -- an N/A vs N/A pair never enters the calculation", () => {
    const mine: MyRankingEntry[] = [
      { itemId: "a", tier: "N/A", position: 0 },
      { itemId: "b", tier: "S", position: 0 },
    ];
    const items = [item({ itemId: "a" }), item({ itemId: "b", label: "Item B" })];
    const rows = compareRankings(
      toComparisonInput(
        [
          { itemId: "a", tier: "N/A", position: 0 },
          { itemId: "b", tier: "S", position: 0 },
        ],
        items,
      ),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    // Only the S/S pair is opinion-bearing on both sides.
    expect(rows).toHaveLength(1);
    expect(computeAgreement(rows, TIER_CONFIG)).toEqual({
      hasSharedRatings: true,
      agreementPct: 100,
    });
  });

  it("zero jointly-scored items -> hasSharedRatings: false, agreementPct: null", () => {
    expect(computeAgreement([], TIER_CONFIG)).toEqual({
      hasSharedRatings: false,
      agreementPct: null,
    });
  });
});

describe("biggestDisagreement", () => {
  it("picks the jointly-scored item with the largest weight difference", () => {
    const mine: MyRankingEntry[] = [
      { itemId: "a", tier: "A", position: 0 }, // diff 1 vs S
      { itemId: "b", tier: "F", position: 0 }, // diff 4 vs S -- biggest
    ];
    const items = [item({ itemId: "a" }), item({ itemId: "b", label: "Item B" })];
    const rows = compareRankings(
      toComparisonInput(
        [
          { itemId: "a", tier: "S", position: 0 },
          { itemId: "b", tier: "S", position: 0 },
        ],
        items,
      ),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    expect(biggestDisagreement(rows, TIER_CONFIG)?.itemId).toBe("b");
  });

  it("returns null when every jointly-scored item matches exactly", () => {
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "S", position: 0 }];
    const rows = compareRankings(
      toComparisonInput([{ itemId: "a", tier: "S", position: 0 }], [item({ itemId: "a" })]),
      mine,
      TIER_CONFIG,
    ).opinionRows;
    expect(biggestDisagreement(rows, TIER_CONFIG)).toBeNull();
  });
});

describe("summarizeFriendComparison", () => {
  it("combines same-placement count, agreement, and biggest disagreement in one call", () => {
    const mine: MyRankingEntry[] = [
      { itemId: "a", tier: "S", position: 0 },
      { itemId: "b", tier: "N/A", position: 0 },
    ];
    const items = [item({ itemId: "a" }), item({ itemId: "b", label: "Item B" })];
    const friendRanking: FriendResultEntry["ranking"] = [
      { itemId: "a", tier: "S", position: 0 },
      { itemId: "b", tier: "N/A", position: 0 },
    ];
    const summary = summarizeFriendComparison(friendRanking, mine, items, TIER_CONFIG);
    expect(summary.samePlacementCount).toBe(2); // literal match, including the shared N/A
    expect(summary.totalCount).toBe(2);
    expect(summary.agreement).toEqual({ hasSharedRatings: true, agreementPct: 100 });
    expect(summary.biggestDisagreement).toBeNull();
  });
});
