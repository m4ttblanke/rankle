import type { DailyGame } from "./schema";
import type { SubmissionItem } from "./submission";

/**
 * The one source of truth for the interactive ranking board (Milestone 2).
 *
 * `placement` maps every container id -> an ordered list of item ids. Containers
 * are the unranked pool plus one per `game.tierConfig` entry (custom tier labels
 * work exactly the same — nothing here depends on the literal "S"/"A"/… values).
 * Every game item id appears in exactly one list.
 *
 * All interactions — pointer drag, tap/click picker, keyboard picker, reorder
 * buttons — go through a single operation: `moveItem` (via the `MOVE` action).
 * No persistence, no network: this state lives only in a `useReducer`.
 */

export const UNRANKED = "unranked";

export type ContainerId = string;

export type RankingState = {
  placement: Record<ContainerId, string[]>;
  /** Item currently targeted by the non-drag picker, or null. */
  selectedItemId: string | null;
};

/** Ordered container ids for a game: the pool first, then each configured tier. */
export function containerIdsForGame(game: DailyGame): ContainerId[] {
  return [UNRANKED, ...game.tierConfig];
}

export function createInitialRanking(game: DailyGame): RankingState {
  const placement: Record<ContainerId, string[]> = { [UNRANKED]: [] };
  for (const tier of game.tierConfig) placement[tier] = [];
  placement[UNRANKED] = [...game.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((it) => it.id);
  return { placement, selectedItemId: null };
}

/** Which container currently holds `itemId`, or null if it isn't in the state. */
export function findContainer(
  state: RankingState,
  itemId: string,
): ContainerId | null {
  for (const cid of Object.keys(state.placement)) {
    if (state.placement[cid].includes(itemId)) return cid;
  }
  return null;
}

export type MoveInput = {
  itemId: string;
  to: ContainerId;
  /** Insert position within the target list; defaults to the end. */
  toIndex?: number;
};

/**
 * Move an item to a container at a position. Covers every case: pool -> tier,
 * tier -> tier, tier -> pool, and reordering within a container. Returns the
 * same reference (no-op) when the item is unknown, the target container is
 * unknown, or the move would not change anything.
 */
export function moveItem(
  state: RankingState,
  { itemId, to, toIndex }: MoveInput,
): RankingState {
  const from = findContainer(state, itemId);
  if (from === null) return state;
  if (!(to in state.placement)) return state;

  const fromList = state.placement[from];
  const fromIndex = fromList.indexOf(itemId);
  const withoutItem = fromList.filter((id) => id !== itemId);
  const targetBase = from === to ? withoutItem : state.placement[to];

  const insertAt = Math.max(0, Math.min(toIndex ?? targetBase.length, targetBase.length));

  if (from === to && insertAt === fromIndex) return state;

  const nextTarget = [
    ...targetBase.slice(0, insertAt),
    itemId,
    ...targetBase.slice(insertAt),
  ];

  const placement = { ...state.placement };
  if (from === to) {
    placement[to] = nextTarget;
  } else {
    placement[from] = withoutItem;
    placement[to] = nextTarget;
  }
  return { ...state, placement };
}

// --- selectors ---------------------------------------------------------------

export function unrankedIds(state: RankingState): string[] {
  return state.placement[UNRANKED] ?? [];
}

export function unrankedCount(state: RankingState): number {
  return unrankedIds(state).length;
}

export function isComplete(state: RankingState): boolean {
  return unrankedCount(state) === 0;
}

/**
 * Derive the exact `submit_ranking` payload from the ranking state. A pure
 * projection of `RankingState` — NOT a second representation. Tier order follows
 * `game.tierConfig`; within a tier, `position` is the array index, so the
 * player's ordering is preserved exactly. Unranked items are omitted (official
 * submission is gated on an empty pool, both in the UI and by the RPC).
 */
export function toSubmissionPayload(
  state: RankingState,
  game: DailyGame,
): SubmissionItem[] {
  const payload: SubmissionItem[] = [];
  for (const tier of game.tierConfig) {
    const ids = state.placement[tier] ?? [];
    ids.forEach((itemId, position) => {
      payload.push({ item_id: itemId, tier, position });
    });
  }
  return payload;
}

// --- reducer ---------------------------------------------------------------

export type RankingAction =
  | { type: "MOVE"; itemId: string; to: ContainerId; toIndex?: number }
  | { type: "SELECT"; itemId: string | null }
  | { type: "RESET"; game: DailyGame };

export function rankingReducer(
  state: RankingState,
  action: RankingAction,
): RankingState {
  switch (action.type) {
    case "MOVE":
      return moveItem(state, {
        itemId: action.itemId,
        to: action.to,
        toIndex: action.toIndex,
      });
    case "SELECT":
      return state.selectedItemId === action.itemId
        ? state
        : { ...state, selectedItemId: action.itemId };
    case "RESET":
      return createInitialRanking(action.game);
    default:
      return state;
  }
}
