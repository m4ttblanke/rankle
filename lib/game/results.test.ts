import { describe, expect, it } from "vitest";
import {
  HOTTEST_TAKE_MIN_DIFF,
  HOTTEST_TAKE_MIN_RESPONSES,
  MIN_RESPONSES_FOR_VERDICT,
  communityTierForAvg,
  communityTierList,
  consensusControversy,
  hottestTake,
  isEarlyResults,
  itemDistribution,
  opinionTiers,
  tierWeight,
} from "./results";
import type { GameResults, MyRankingEntry, ResultsItem } from "./results-schema";

const CANONICAL = ["S", "A", "B", "C", "F", "N/A"];

function item(overrides: Partial<ResultsItem> = {}): ResultsItem {
  return {
    itemId: "item-1",
    label: "Item",
    imageUrl: null,
    sortOrder: 0,
    tierCounts: {},
    n: 0,
    sumWeight: 0,
    avgWeight: null,
    ...overrides,
  };
}

describe("opinionTiers", () => {
  it("excludes N/A by identity, not by position", () => {
    expect(opinionTiers(CANONICAL)).toEqual(["S", "A", "B", "C", "F"]);
    // N/A in the middle of a hypothetical custom scale still gets excluded.
    expect(opinionTiers(["S", "N/A", "A", "B"])).toEqual(["S", "A", "B"]);
  });
});

describe("tierWeight", () => {
  it("weights the canonical scale positionally: S=6..F=2", () => {
    expect(tierWeight(CANONICAL, "S")).toBe(6);
    expect(tierWeight(CANONICAL, "A")).toBe(5);
    expect(tierWeight(CANONICAL, "B")).toBe(4);
    expect(tierWeight(CANONICAL, "C")).toBe(3);
    expect(tierWeight(CANONICAL, "F")).toBe(2);
  });

  it("N/A is always 0, checked by identity even if not last", () => {
    expect(tierWeight(CANONICAL, "N/A")).toBe(0);
    expect(tierWeight(["S", "N/A", "A", "B"], "N/A")).toBe(0);
  });

  it("an unknown tier is 0", () => {
    expect(tierWeight(CANONICAL, "Z")).toBe(0);
  });
});

describe("communityTierForAvg", () => {
  it("picks the nearest tier for a non-tied average", () => {
    expect(communityTierForAvg(CANONICAL, 5.9)).toBe("S");
    expect(communityTierForAvg(CANONICAL, 4.1)).toBe("B");
    expect(communityTierForAvg(CANONICAL, 2.0)).toBe("F");
    expect(communityTierForAvg(CANONICAL, 6.0)).toBe("S");
  });

  it("rounds an exact halfway average to the HIGHER tier — every boundary", () => {
    expect(communityTierForAvg(CANONICAL, 5.5)).toBe("S"); // between A(5) and S(6)
    expect(communityTierForAvg(CANONICAL, 4.5)).toBe("A"); // between B(4) and A(5)
    expect(communityTierForAvg(CANONICAL, 3.5)).toBe("B"); // between C(3) and B(4)
    expect(communityTierForAvg(CANONICAL, 2.5)).toBe("C"); // between F(2) and C(3)
  });
});

describe("communityTierList", () => {
  it("buckets rated items into rows and unrated items into their own bucket", () => {
    const items = [
      item({ itemId: "s-item", sortOrder: 0, avgWeight: 6, n: 2 }),
      item({ itemId: "unrated-item", sortOrder: 1, avgWeight: null, n: 0 }),
      item({ itemId: "f-item", sortOrder: 2, avgWeight: 2, n: 2 }),
    ];
    const list = communityTierList(items, CANONICAL);
    expect(list.rows.map((r) => r.tier)).toEqual(["S", "A", "B", "C", "F"]);
    expect(list.rows.find((r) => r.tier === "S")?.items.map((i) => i.itemId)).toEqual([
      "s-item",
    ]);
    expect(list.rows.find((r) => r.tier === "F")?.items.map((i) => i.itemId)).toEqual([
      "f-item",
    ]);
    expect(list.unrated.map((i) => i.itemId)).toEqual(["unrated-item"]);
  });

  it("never forces a zero-scored-response item into F", () => {
    const items = [item({ itemId: "only-na", avgWeight: null, n: 0 })];
    const list = communityTierList(items, CANONICAL);
    expect(list.rows.find((r) => r.tier === "F")?.items).toEqual([]);
    expect(list.unrated.map((i) => i.itemId)).toEqual(["only-na"]);
  });

  it("orders by avgWeight desc, ties broken by sortOrder ascending (deterministic)", () => {
    const items = [
      item({ itemId: "b", sortOrder: 5, avgWeight: 6, n: 2 }),
      item({ itemId: "a", sortOrder: 1, avgWeight: 6, n: 2 }),
      item({ itemId: "c", sortOrder: 3, avgWeight: 6, n: 2 }),
    ];
    const list = communityTierList(items, CANONICAL);
    const sTier = list.rows.find((r) => r.tier === "S")!;
    expect(sTier.items.map((i) => i.itemId)).toEqual(["a", "c", "b"]);
  });
});

describe("itemDistribution", () => {
  it("computes per-tier share of n, and N/A share of TOTAL game submissions", () => {
    const it1 = item({
      tierCounts: { S: 2, A: 1, "N/A": 3 },
      n: 3, // scored responses only — N/A already excluded upstream
      avgWeight: 5.67,
    });
    const dist = itemDistribution(it1, CANONICAL, 10); // 10 total game submissions
    const s = dist.scored.find((x) => x.tier === "S")!;
    expect(s.count).toBe(2);
    expect(s.pct).toBeCloseTo(2 / 3);
    expect(dist.naCount).toBe(3);
    // naPct must use the game-wide total (10), NOT n (3).
    expect(dist.naPct).toBeCloseTo(3 / 10);
  });

  it("an item with zero scored responses has zero pct for every tier, not NaN", () => {
    const dist = itemDistribution(item({ n: 0 }), CANONICAL, 5);
    for (const s of dist.scored) expect(s.pct).toBe(0);
  });

  it("naPct is 0 when the game itself has 0 total submissions (defensive)", () => {
    const dist = itemDistribution(item({ tierCounts: { "N/A": 1 } }), CANONICAL, 0);
    expect(dist.naPct).toBe(0);
  });
});

describe("consensusControversy", () => {
  it("all responses in one tier -> zero controversy, full consensus", () => {
    const it1 = item({ tierCounts: { S: 5 }, n: 5, avgWeight: 6 });
    const result = consensusControversy(it1, CANONICAL);
    expect(result.controversy).toBe(0);
    expect(result.consensus).toBe(1);
  });

  it("a 50/50 split at the two extremes -> maximum controversy", () => {
    // half S (weight 6), half F (weight 2); mean = 4
    const it1 = item({ tierCounts: { S: 3, F: 3 }, n: 6, avgWeight: 4 });
    const result = consensusControversy(it1, CANONICAL);
    expect(result.controversy).toBeCloseTo(1);
    expect(result.consensus).toBeCloseTo(0);
  });

  it("a moderate spread lands strictly between 0 and 1", () => {
    const it1 = item({ tierCounts: { S: 1, A: 1, B: 1, C: 1, F: 1 }, n: 5, avgWeight: 4 });
    const result = consensusControversy(it1, CANONICAL);
    expect(result.controversy).toBeGreaterThan(0);
    expect(result.controversy).toBeLessThan(1);
  });

  it("N/A responses never enter the variance, even if present in tier_counts", () => {
    const withoutNA = item({ tierCounts: { S: 5 }, n: 5, avgWeight: 6 });
    const withNA = item({ tierCounts: { S: 5, "N/A": 20 }, n: 5, avgWeight: 6 });
    expect(consensusControversy(withNA, CANONICAL)).toEqual(
      consensusControversy(withoutNA, CANONICAL),
    );
  });

  it("zero scored responses -> unrated, no verdict at all (not zero, not F)", () => {
    const result = consensusControversy(item({ n: 0, avgWeight: null }), CANONICAL);
    expect(result.consensus).toBeNull();
    expect(result.controversy).toBeNull();
    expect(result.insufficientData).toBe(true);
  });

  it.each([1, 2])(
    "flags insufficientData when n=%i is below MIN_RESPONSES_FOR_VERDICT (%i)",
    (n) => {
      expect(n).toBeLessThan(MIN_RESPONSES_FOR_VERDICT);
      const it1 = item({ tierCounts: { S: n }, n, avgWeight: 6 });
      const result = consensusControversy(it1, CANONICAL);
      expect(result.insufficientData).toBe(true);
      // The number itself is still computed — only the *label* is gated.
      expect(result.consensus).not.toBeNull();
    },
  );

  it("does not flag insufficientData once n reaches MIN_RESPONSES_FOR_VERDICT", () => {
    const it1 = item({ tierCounts: { S: MIN_RESPONSES_FOR_VERDICT }, n: MIN_RESPONSES_FOR_VERDICT, avgWeight: 6 });
    expect(consensusControversy(it1, CANONICAL).insufficientData).toBe(false);
  });
});

describe("hottestTake", () => {
  const items: ResultsItem[] = [
    item({ itemId: "agree", sortOrder: 0, n: 5, avgWeight: 6 }), // player also S -> diff 0
    item({ itemId: "disagree-small", sortOrder: 1, n: 5, avgWeight: 5.5 }),
    item({ itemId: "disagree-big", sortOrder: 2, n: 5, avgWeight: 2 }),
    item({ itemId: "low-data", sortOrder: 3, n: 1, avgWeight: 2 }), // below HOTTEST_TAKE_MIN_RESPONSES
    item({ itemId: "unrated", sortOrder: 4, n: 0, avgWeight: null }),
  ];

  function ranking(overrides: Partial<Record<string, string>> = {}): MyRankingEntry[] {
    const base: Record<string, string> = {
      agree: "S",
      "disagree-small": "S",
      "disagree-big": "S",
      "low-data": "S",
      unrated: "S",
      ...overrides,
    };
    return Object.entries(base).map(([itemId, tier], position) => ({
      itemId,
      tier,
      position,
    }));
  }

  it("picks the largest meaningful disagreement, ignoring ties/small diffs/insufficient data", () => {
    const take = hottestTake(ranking(), items, CANONICAL);
    expect(take).toMatchObject({ kind: "found", itemId: "disagree-big", direction: "higher" });
  });

  it("excludes the player's N/A placements outright", () => {
    const take = hottestTake(ranking({ "disagree-big": "N/A" }), items, CANONICAL);
    // next-largest eligible diff is disagree-small (|6-5.5|=0.5 < MIN_DIFF) -> none
    expect(take).toEqual({ kind: "none" });
  });

  it(`requires at least ${HOTTEST_TAKE_MIN_RESPONSES} scored responses (excludes "low-data")`, () => {
    const soloItems = [item({ itemId: "solo", sortOrder: 0, n: 1, avgWeight: 2 })];
    const take = hottestTake(
      [{ itemId: "solo", tier: "S", position: 0 }],
      soloItems,
      CANONICAL,
    );
    expect(take).toEqual({ kind: "none" });
  });

  it(`requires at least ${HOTTEST_TAKE_MIN_DIFF} full tier of difference`, () => {
    const closeItems = [item({ itemId: "close", sortOrder: 0, n: 5, avgWeight: 5.9 })];
    const take = hottestTake(
      [{ itemId: "close", tier: "S", position: 0 }],
      closeItems,
      CANONICAL,
    );
    expect(take).toEqual({ kind: "none" });
  });

  it("never manufactures disagreement when the player is the only scored response", () => {
    // The player's own submission IS the average: diff is exactly 0.
    const soloItems = [item({ itemId: "solo", sortOrder: 0, n: 1, avgWeight: 6 })];
    const take = hottestTake(
      [{ itemId: "solo", tier: "S", position: 0 }],
      soloItems,
      CANONICAL,
    );
    expect(take).toEqual({ kind: "none" });
  });

  it("breaks ties deterministically by the item's sortOrder", () => {
    const tiedItems = [
      item({ itemId: "later", sortOrder: 9, n: 5, avgWeight: 2 }),
      item({ itemId: "earlier", sortOrder: 1, n: 5, avgWeight: 2 }),
    ];
    const take = hottestTake(
      [
        { itemId: "later", tier: "S", position: 0 },
        { itemId: "earlier", tier: "S", position: 1 },
      ],
      tiedItems,
      CANONICAL,
    );
    expect(take).toMatchObject({ kind: "found", itemId: "earlier" });
  });

  it("no eligible candidates -> a graceful none, not a manufactured take", () => {
    const take = hottestTake(
      [{ itemId: "unrated", tier: "S", position: 0 }],
      items,
      CANONICAL,
    );
    expect(take).toEqual({ kind: "none" });
  });

  it("reports direction: lower when the player rated below the community", () => {
    const lowItems = [item({ itemId: "x", sortOrder: 0, n: 5, avgWeight: 6 })];
    const take = hottestTake(
      [{ itemId: "x", tier: "F", position: 0 }],
      lowItems,
      CANONICAL,
    );
    expect(take).toMatchObject({ kind: "found", direction: "lower" });
  });
});

describe("isEarlyResults", () => {
  const base: GameResults = {
    tierlist: { id: "t", slug: "s", title: "T", prompt: null, tierConfig: CANONICAL },
    totalSubmissions: 0,
    items: [],
    myRanking: [],
  };

  it("is early below MIN_RESPONSES_FOR_VERDICT and not at/above it", () => {
    expect(isEarlyResults({ ...base, totalSubmissions: 1 })).toBe(true);
    expect(isEarlyResults({ ...base, totalSubmissions: MIN_RESPONSES_FOR_VERDICT - 1 })).toBe(
      true,
    );
    expect(isEarlyResults({ ...base, totalSubmissions: MIN_RESPONSES_FOR_VERDICT })).toBe(
      false,
    );
  });
});
