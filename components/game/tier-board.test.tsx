// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { DailyGame } from "@/lib/game/schema";
import { TierBoard } from "./tier-board";

afterEach(cleanup);

const game: DailyGame = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fast-food-fries",
  title: "Fast Food Fries",
  prompt: "Rank the fries.",
  releaseDate: "2026-09-08",
  tierConfig: ["S", "A", "B", "C", "D"],
  items: [
    { id: "a1111111-1111-4111-8111-111111111111", label: "McDonald's", imageUrl: null, sortOrder: 0 },
    { id: "b1111111-1111-4111-8111-111111111111", label: "Five Guys", imageUrl: null, sortOrder: 1 },
    { id: "c1111111-1111-4111-8111-111111111111", label: "In-N-Out", imageUrl: null, sortOrder: 2 },
  ],
};

describe("<TierBoard>", () => {
  it("renders one lane per configured tier with the tier letter as text", () => {
    render(<TierBoard game={game} />);
    const lanes = screen.getAllByRole("listitem");
    // 3 line-up items + 5 tier lanes
    expect(lanes).toHaveLength(8);
    for (const letter of game.tierConfig) {
      // "Tier " is sr-only, the visible glyph is the letter itself
      expect(screen.getByText(letter, { selector: "span" })).toBeTruthy();
    }
  });

  it("shows every item's label as readable text in the line-up", () => {
    render(<TierBoard game={game} />);
    const lineup = screen.getByRole("list", { name: /line-up/i });
    for (const item of game.items) {
      expect(within(lineup).getByText(item.label)).toBeTruthy();
    }
  });

  it("reports the item count", () => {
    render(<TierBoard game={game} />);
    expect(screen.getByText(/line-up · 3 items/i)).toBeTruthy();
  });

  it("supports custom tier labels (neutral fallback, no crash)", () => {
    render(<TierBoard game={{ ...game, tierConfig: ["Top", "Mid", "Bottom"] }} />);
    for (const label of ["Top", "Mid", "Bottom"]) {
      expect(screen.getByText(label, { selector: "span" })).toBeTruthy();
    }
  });

  it("handles a game with no items", () => {
    render(<TierBoard game={{ ...game, items: [] }} />);
    expect(screen.getByText(/no items yet/i)).toBeTruthy();
    expect(screen.getByText(/line-up · 0 items/i)).toBeTruthy();
  });
});
