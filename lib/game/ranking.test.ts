import { describe, expect, it } from "vitest";
import type { DailyGame } from "./schema";
import {
  UNRANKED,
  containerIdsForGame,
  createInitialRanking,
  findContainer,
  isComplete,
  moveItem,
  rankingReducer,
  toSubmissionPayload,
  unrankedCount,
  type RankingState,
} from "./ranking";

function makeGame(
  tierConfig: string[] = ["S", "A", "B", "C", "D"],
  itemLabels: string[] = ["a", "b", "c", "d"],
): DailyGame {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "g",
    title: "G",
    prompt: null,
    releaseDate: "2026-09-08",
    tierConfig,
    items: itemLabels.map((label, i) => ({
      id: `item-${label}`,
      label,
      imageUrl: null,
      // deliberately reversed so createInitialRanking must sort by sortOrder
      sortOrder: itemLabels.length - 1 - i,
    })),
  };
}

const game = makeGame();

function ids(state: RankingState, container: string) {
  return state.placement[container];
}

describe("createInitialRanking", () => {
  it("puts every item in Unranked, ordered by sortOrder, tiers empty", () => {
    const s = createInitialRanking(game);
    expect(ids(s, UNRANKED)).toEqual(["item-d", "item-c", "item-b", "item-a"]);
    for (const tier of game.tierConfig) expect(ids(s, tier)).toEqual([]);
    expect(s.selectedItemId).toBeNull();
  });

  it("derives containers from tierConfig (custom labels)", () => {
    const s = createInitialRanking(makeGame(["Top", "Mid", "Bot"], ["x", "y"]));
    expect(Object.keys(s.placement).sort()).toEqual(
      [UNRANKED, "Top", "Mid", "Bot"].sort(),
    );
    expect(containerIdsForGame(makeGame(["Top", "Mid", "Bot"]))).toEqual([
      UNRANKED,
      "Top",
      "Mid",
      "Bot",
    ]);
  });
});

describe("moveItem", () => {
  const start = createInitialRanking(game); // unranked: d,c,b,a

  it("pool -> tier (appends to end by default)", () => {
    const s = moveItem(start, { itemId: "item-c", to: "S" });
    expect(ids(s, "S")).toEqual(["item-c"]);
    expect(ids(s, UNRANKED)).toEqual(["item-d", "item-b", "item-a"]);
  });

  it("pool -> tier at an explicit index", () => {
    let s = moveItem(start, { itemId: "item-c", to: "S" });
    s = moveItem(s, { itemId: "item-a", to: "S", toIndex: 0 });
    expect(ids(s, "S")).toEqual(["item-a", "item-c"]);
  });

  it("tier -> tier", () => {
    let s = moveItem(start, { itemId: "item-c", to: "S" });
    s = moveItem(s, { itemId: "item-c", to: "B" });
    expect(ids(s, "S")).toEqual([]);
    expect(ids(s, "B")).toEqual(["item-c"]);
  });

  it("tier -> pool (returns the item)", () => {
    let s = moveItem(start, { itemId: "item-c", to: "S" });
    s = moveItem(s, { itemId: "item-c", to: UNRANKED });
    expect(ids(s, "S")).toEqual([]);
    expect(ids(s, UNRANKED)).toContain("item-c");
    expect(ids(s, UNRANKED)).toHaveLength(4);
  });

  it("reorders within a container (move up / move down)", () => {
    let s = start;
    for (const id of ["item-d", "item-c", "item-b", "item-a"]) {
      s = moveItem(s, { itemId: id, to: "A" });
    }
    expect(ids(s, "A")).toEqual(["item-d", "item-c", "item-b", "item-a"]);
    // move "item-b" (index 2) up one -> index 1
    s = moveItem(s, { itemId: "item-b", to: "A", toIndex: 1 });
    expect(ids(s, "A")).toEqual(["item-d", "item-b", "item-c", "item-a"]);
    // move "item-b" down one -> back to index 2
    s = moveItem(s, { itemId: "item-b", to: "A", toIndex: 2 });
    expect(ids(s, "A")).toEqual(["item-d", "item-c", "item-b", "item-a"]);
  });

  it("clamps an out-of-range index", () => {
    let s = moveItem(start, { itemId: "item-a", to: "S" });
    s = moveItem(s, { itemId: "item-b", to: "S", toIndex: 99 });
    expect(ids(s, "S")).toEqual(["item-a", "item-b"]);
  });

  it("is a no-op (same reference) for an unknown item or container", () => {
    expect(moveItem(start, { itemId: "nope", to: "S" })).toBe(start);
    expect(moveItem(start, { itemId: "item-a", to: "Z" })).toBe(start);
  });

  it("is a no-op when reordering to the same position", () => {
    let s = moveItem(start, { itemId: "item-a", to: "S" });
    s = moveItem(s, { itemId: "item-b", to: "S" }); // S: a, b
    const same = moveItem(s, { itemId: "item-b", to: "S", toIndex: 1 });
    expect(same).toBe(s);
  });

  it("keeps every item in exactly one container after any sequence", () => {
    let s = createInitialRanking(game);
    const moves: Array<[string, string]> = [
      ["item-a", "S"],
      ["item-b", "S"],
      ["item-a", "B"],
      ["item-c", "S"],
      ["item-b", UNRANKED],
      ["item-d", "D"],
      ["item-a", "D"],
    ];
    for (const [itemId, to] of moves) s = moveItem(s, { itemId, to });
    const all = Object.values(s.placement).flat();
    expect(all.sort()).toEqual(["item-a", "item-b", "item-c", "item-d"]);
    for (const id of ["item-a", "item-b", "item-c", "item-d"]) {
      const inContainers = Object.keys(s.placement).filter((c) =>
        s.placement[c].includes(id),
      );
      expect(inContainers).toHaveLength(1);
    }
  });
});

describe("selectors", () => {
  it("unrankedCount / isComplete track the pool", () => {
    let s = createInitialRanking(game);
    expect(unrankedCount(s)).toBe(4);
    expect(isComplete(s)).toBe(false);
    s = moveItem(s, { itemId: "item-a", to: "S" });
    s = moveItem(s, { itemId: "item-b", to: "S" });
    s = moveItem(s, { itemId: "item-c", to: "A" });
    s = moveItem(s, { itemId: "item-d", to: "B" });
    expect(unrankedCount(s)).toBe(0);
    expect(isComplete(s)).toBe(true);
  });

  it("findContainer locates an item", () => {
    const s = moveItem(createInitialRanking(game), { itemId: "item-c", to: "A" });
    expect(findContainer(s, "item-c")).toBe("A");
    expect(findContainer(s, "item-a")).toBe(UNRANKED);
    expect(findContainer(s, "missing")).toBeNull();
  });
});

describe("rankingReducer", () => {
  it("MOVE applies the move; SELECT is independent of MOVE", () => {
    let s = createInitialRanking(game);
    s = rankingReducer(s, { type: "SELECT", itemId: "item-a" });
    expect(s.selectedItemId).toBe("item-a");
    s = rankingReducer(s, { type: "MOVE", itemId: "item-a", to: "S" });
    expect(s.placement.S).toEqual(["item-a"]);
    // MOVE does not clear selection — callers manage SELECT explicitly
    expect(s.selectedItemId).toBe("item-a");
    s = rankingReducer(s, { type: "SELECT", itemId: null });
    expect(s.selectedItemId).toBeNull();
  });

  it("RESET restores the initial ranking", () => {
    let s = createInitialRanking(game);
    s = rankingReducer(s, { type: "MOVE", itemId: "item-a", to: "S" });
    s = rankingReducer(s, { type: "RESET", game });
    expect(s.placement.S).toEqual([]);
    expect(unrankedCount(s)).toBe(4);
  });
});

describe("toSubmissionPayload", () => {
  it("derives one row per placed item, tier order following tierConfig", () => {
    let s = createInitialRanking(game); // tierConfig S,A,B,C,D
    s = moveItem(s, { itemId: "item-a", to: "A" });
    s = moveItem(s, { itemId: "item-b", to: "S" });
    s = moveItem(s, { itemId: "item-c", to: "A" });
    expect(toSubmissionPayload(s, game)).toEqual([
      { item_id: "item-b", tier: "S", position: 0 },
      { item_id: "item-a", tier: "A", position: 0 },
      { item_id: "item-c", tier: "A", position: 1 },
    ]);
  });

  it("position is the within-tier array index, preserving reorder", () => {
    let s = createInitialRanking(game);
    for (const id of ["item-d", "item-c", "item-b", "item-a"]) {
      s = moveItem(s, { itemId: id, to: "B" });
    }
    s = moveItem(s, { itemId: "item-b", to: "B", toIndex: 0 }); // reorder to front
    expect(toSubmissionPayload(s, game)).toEqual([
      { item_id: "item-b", tier: "B", position: 0 },
      { item_id: "item-d", tier: "B", position: 1 },
      { item_id: "item-c", tier: "B", position: 2 },
      { item_id: "item-a", tier: "B", position: 3 },
    ]);
  });

  it("omits unranked items entirely", () => {
    let s = createInitialRanking(game);
    s = moveItem(s, { itemId: "item-a", to: "S" });
    // b, c, d stay in the pool
    expect(toSubmissionPayload(s, game)).toEqual([
      { item_id: "item-a", tier: "S", position: 0 },
    ]);
  });

  it("empty ranking yields an empty payload", () => {
    const s = createInitialRanking(game);
    expect(toSubmissionPayload(s, game)).toEqual([]);
  });

  it("works with custom tier labels", () => {
    const customGame = makeGame(["Top", "Mid", "Bot"], ["x", "y"]);
    let s = createInitialRanking(customGame);
    s = moveItem(s, { itemId: "item-y", to: "Bot" });
    s = moveItem(s, { itemId: "item-x", to: "Top" });
    expect(toSubmissionPayload(s, customGame)).toEqual([
      { item_id: "item-x", tier: "Top", position: 0 },
      { item_id: "item-y", tier: "Bot", position: 0 },
    ]);
  });
});
