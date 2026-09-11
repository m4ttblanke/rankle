import { describe, expect, it } from "vitest";
import {
  DAILY_GAME_SELECT,
  DAILY_GAME_STATUSES,
  dailyGameRowSchema,
  mapDailyGame,
  tierConfigSchema,
} from "./schema";

const validRow = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "fast-food-fries",
  title: "Fast Food Fries",
  prompt: "Rank the fries. No fence-sitting.",
  release_date: "2026-09-08",
  tier_config: ["S", "A", "B", "C", "F", "N/A"],
  tierlist_items: [
    { id: "10000000-0000-0000-0000-0000000000c1", label: "In-N-Out", image_url: null, sort_order: 2 },
    { id: "10000000-0000-0000-0000-0000000000a1", label: "McDonald's", image_url: "https://x/i.png", sort_order: 0 },
    { id: "10000000-0000-0000-0000-0000000000b1", label: "Five Guys", image_url: null, sort_order: 1 },
  ],
};

describe("mapDailyGame", () => {
  it("shapes a valid row and sorts items by sort_order", () => {
    const game = mapDailyGame(validRow);
    expect(game).toMatchObject({
      id: validRow.id,
      slug: "fast-food-fries",
      title: "Fast Food Fries",
      prompt: "Rank the fries. No fence-sitting.",
      releaseDate: "2026-09-08",
      tierConfig: ["S", "A", "B", "C", "F", "N/A"],
    });
    expect(game.items.map((i) => i.label)).toEqual([
      "McDonald's",
      "Five Guys",
      "In-N-Out",
    ]);
    expect(game.items[0]).toEqual({
      id: "10000000-0000-0000-0000-0000000000a1",
      label: "McDonald's",
      imageUrl: "https://x/i.png",
      sortOrder: 0,
    });
  });

  it("accepts a null prompt and an empty item list", () => {
    const game = mapDailyGame({ ...validRow, prompt: null, tierlist_items: [] });
    expect(game.prompt).toBeNull();
    expect(game.items).toEqual([]);
  });

  it("accepts a non-standard tier configuration within bounds", () => {
    const game = mapDailyGame({ ...validRow, tier_config: ["Top", "Mid", "Bot"] });
    expect(game.tierConfig).toEqual(["Top", "Mid", "Bot"]);
  });

  it.each([
    ["missing id", { ...validRow, id: undefined }],
    ["non-uuid id", { ...validRow, id: "not-a-uuid" }],
    ["null release_date", { ...validRow, release_date: null }],
    ["tier_config with one entry", { ...validRow, tier_config: ["S"] }],
    ["tier_config with nine entries", { ...validRow, tier_config: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }],
    ["tier_config not an array", { ...validRow, tier_config: "S,A,B" }],
    ["item missing label", { ...validRow, tierlist_items: [{ id: validRow.id, image_url: null, sort_order: 0 }] }],
    ["negative sort_order", { ...validRow, tierlist_items: [{ id: validRow.id, label: "x", image_url: null, sort_order: -1 }] }],
  ])("throws on %s", (_name, row) => {
    expect(() => mapDailyGame(row)).toThrow();
  });
});

describe("schema pieces", () => {
  it("tierConfigSchema enforces 2..8 entries", () => {
    expect(tierConfigSchema.safeParse(["S", "A"]).success).toBe(true);
    expect(tierConfigSchema.safeParse(["S"]).success).toBe(false);
    expect(tierConfigSchema.safeParse([]).success).toBe(false);
  });

  it("tierConfigSchema accepts the canonical S/A/B/C/F/N/A scale", () => {
    expect(
      tierConfigSchema.safeParse(["S", "A", "B", "C", "F", "N/A"]).success,
    ).toBe(true);
  });

  it("dailyGameRowSchema is exported and usable", () => {
    expect(dailyGameRowSchema.safeParse(validRow).success).toBe(true);
  });
});

describe("resolver query constants", () => {
  it("targets only scheduled + live (archived excluded)", () => {
    expect([...DAILY_GAME_STATUSES]).toEqual(["scheduled", "live"]);
  });

  it("select string embeds items and lists every field mapDailyGame needs", () => {
    for (const col of ["id", "slug", "title", "prompt", "release_date", "tier_config"]) {
      expect(DAILY_GAME_SELECT).toContain(col);
    }
    expect(DAILY_GAME_SELECT).toContain(
      "tierlist_items(id, label, image_url, sort_order)",
    );
  });
});
