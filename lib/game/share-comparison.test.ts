import { describe, expect, it } from "vitest";
import { compareRankings } from "./share-comparison";
import type { ShareRankingItem } from "./share-schema";
import type { MyRankingEntry } from "./results-schema";

const TIER_CONFIG = ["S", "A", "B", "C", "F", "N/A"];

function senderItem(overrides: Partial<ShareRankingItem>): ShareRankingItem {
  return {
    itemId: "item-a",
    label: "Item A",
    imageUrl: null,
    tier: "S",
    position: 0,
    ...overrides,
  };
}

describe("compareRankings", () => {
  it("counts a literal same-tier match as 'same', including on opinion tiers", () => {
    const sender = [senderItem({ itemId: "a", tier: "S", position: 0 })];
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "S", position: 0 }];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.samePlacementCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.opinionRows[0].same).toBe(true);
  });

  it("a different tier on the same item is not 'same'", () => {
    const sender = [senderItem({ itemId: "a", tier: "S", position: 0 })];
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "F", position: 0 }];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.samePlacementCount).toBe(0);
    expect(result.opinionRows[0].same).toBe(false);
  });

  it("both choosing N/A counts as a literal same-placement match, kept out of opinionRows", () => {
    const sender = [senderItem({ itemId: "a", tier: "N/A", position: 0 })];
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "N/A", position: 0 }];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.samePlacementCount).toBe(1); // literal match -- see docstring
    expect(result.opinionRows).toHaveLength(0);
    expect(result.naRows).toHaveLength(1);
    expect(result.naRows[0].same).toBe(true);
  });

  it("one side N/A and the other an opinion tier is never 'same', and lands in naRows not opinionRows", () => {
    const sender = [senderItem({ itemId: "a", tier: "N/A", position: 0 })];
    const mine: MyRankingEntry[] = [{ itemId: "a", tier: "S", position: 0 }];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.samePlacementCount).toBe(0);
    expect(result.opinionRows).toHaveLength(0);
    expect(result.naRows).toHaveLength(1);
    expect(result.naRows[0].same).toBe(false);
  });

  it("opinionRows sort S..F by tier weight, then by the sender's position within a tier", () => {
    const sender = [
      senderItem({ itemId: "low", tier: "F", position: 0 }),
      senderItem({ itemId: "high-2nd", tier: "S", position: 1 }),
      senderItem({ itemId: "high-1st", tier: "S", position: 0 }),
    ];
    const mine: MyRankingEntry[] = [
      { itemId: "low", tier: "F", position: 0 },
      { itemId: "high-2nd", tier: "F", position: 0 },
      { itemId: "high-1st", tier: "F", position: 0 },
    ];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.opinionRows.map((r) => r.itemId)).toEqual([
      "high-1st",
      "high-2nd",
      "low",
    ]);
  });

  it("an item missing from the recipient's own ranking gets myTier: null, not a crash", () => {
    const sender = [senderItem({ itemId: "a", tier: "S", position: 0 })];
    const result = compareRankings(sender, [], TIER_CONFIG);
    // Defensive-only case (both rankings are for the same fixed item set in
    // practice) -- a missing myTier is never "N/A", so it sorts alongside
    // the other opinion rows rather than a crash or a false "N/A" reading.
    expect(result.opinionRows).toHaveLength(1);
    expect(result.opinionRows[0].myTier).toBeNull();
    expect(result.opinionRows[0].same).toBe(false);
  });

  it("totalCount always equals the sender's own item count", () => {
    const sender = [
      senderItem({ itemId: "a", tier: "S", position: 0 }),
      senderItem({ itemId: "b", tier: "N/A", position: 0 }),
    ];
    const mine: MyRankingEntry[] = [
      { itemId: "a", tier: "S", position: 0 },
      { itemId: "b", tier: "N/A", position: 0 },
    ];
    const result = compareRankings(sender, mine, TIER_CONFIG);
    expect(result.totalCount).toBe(2);
  });
});
