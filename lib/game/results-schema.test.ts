import { describe, expect, it } from "vitest";
import { mapResults, resultsResponseSchema } from "./results-schema";

const validRow = {
  tierlist: {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "fast-food-fries",
    title: "Fast Food Fries",
    prompt: "Rank the fries.",
    tier_config: ["S", "A", "B", "C", "F", "N/A"],
  },
  total_submissions: 3,
  items: [
    {
      item_id: "10000000-0000-0000-0000-0000000000a1",
      label: "McDonald's",
      image_url: null,
      sort_order: 0,
      tier_counts: { S: 2, "N/A": 1 },
      n: 2,
      sum_weight: 12,
      avg_weight: 6,
    },
    {
      item_id: "10000000-0000-0000-0000-0000000000b1",
      label: "Five Guys",
      image_url: "https://x/i.png",
      sort_order: 1,
      tier_counts: {},
      n: 0,
      sum_weight: 0,
      avg_weight: null,
    },
  ],
  my_ranking: [
    { item_id: "10000000-0000-0000-0000-0000000000a1", tier: "S", position: 0 },
    { item_id: "10000000-0000-0000-0000-0000000000b1", tier: "N/A", position: 0 },
  ],
};

describe("resultsResponseSchema", () => {
  it("accepts a well-formed get_results payload", () => {
    expect(resultsResponseSchema.safeParse(validRow).success).toBe(true);
  });

  it.each([
    ["missing tierlist", { ...validRow, tierlist: undefined }],
    ["negative total_submissions", { ...validRow, total_submissions: -1 }],
    ["item missing n", { ...validRow, items: [{ ...validRow.items[0], n: undefined }] }],
    [
      "item with non-integer avg_weight ok but negative n rejected",
      { ...validRow, items: [{ ...validRow.items[0], n: -1 }] },
    ],
    ["my_ranking missing tier", { ...validRow, my_ranking: [{ item_id: validRow.my_ranking[0].item_id, position: 0 }] }],
  ])("rejects %s", (_name, row) => {
    expect(resultsResponseSchema.safeParse(row).success).toBe(false);
  });
});

describe("mapResults", () => {
  it("shapes a valid payload into camelCase GameResults", () => {
    const results = mapResults(validRow);
    expect(results.tierlist).toEqual({
      id: validRow.tierlist.id,
      slug: "fast-food-fries",
      title: "Fast Food Fries",
      prompt: "Rank the fries.",
      tierConfig: ["S", "A", "B", "C", "F", "N/A"],
    });
    expect(results.totalSubmissions).toBe(3);
    expect(results.items[0]).toEqual({
      itemId: "10000000-0000-0000-0000-0000000000a1",
      label: "McDonald's",
      imageUrl: null,
      sortOrder: 0,
      tierCounts: { S: 2, "N/A": 1 },
      n: 2,
      sumWeight: 12,
      avgWeight: 6,
    });
    expect(results.items[1].avgWeight).toBeNull();
    expect(results.myRanking).toEqual([
      { itemId: validRow.items[0].item_id, tier: "S", position: 0 },
      { itemId: validRow.items[1].item_id, tier: "N/A", position: 0 },
    ]);
  });

  it("throws on a malformed payload", () => {
    expect(() => mapResults({ ...validRow, items: "nope" })).toThrow();
  });
});
