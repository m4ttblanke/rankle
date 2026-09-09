"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  UNRANKED,
  createInitialRanking,
  findContainer,
  rankingReducer,
  unrankedCount,
} from "@/lib/game/ranking";
import type { DailyGame } from "@/lib/game/schema";
import { MovePicker } from "./move-picker";
import { RankableCard } from "./rankable-card";
import { RankingContainer } from "./ranking-container";
import { SortableItem } from "./sortable-item";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Pointer position decides the drop target when the cursor is inside a lane;
 * otherwise fall back to the nearest lane by corner distance. Keeps "drop where
 * you point" predictable across the pool and the tier lanes.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : closestCorners(args);
};

function moveMessage(
  label: string,
  container: string,
  index: number,
  remaining: number,
): string {
  if (container === UNRANKED) {
    return `${label} returned to Unranked. ${remaining} left to rank.`;
  }
  const at = `tier ${container}, position ${index + 1}`;
  return remaining === 0
    ? `${label} moved to ${at}. All items ranked.`
    : `${label} moved to ${at}. ${remaining} left to rank.`;
}

/**
 * The interactive daily ranking board — the one stateful client component
 * (docs/DESIGN.md sec 2, sec 12). One `useReducer`, one `moveItem` operation;
 * pointer drag, the tap/keyboard picker, and the reorder buttons all dispatch
 * the same `MOVE`. No persistence, no network, no submission (Milestone 2).
 */
export function RankingBoard({ game }: { game: DailyGame }) {
  const [state, dispatch] = useReducer(
    rankingReducer,
    game,
    createInitialRanking,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const pendingAnnounce = useRef<{ itemId: string; to: string } | null>(null);
  const focusItemId = useRef<string | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  const itemsById = useMemo(
    () => new Map(game.items.map((i) => [i.id, i])),
    [game.items],
  );

  const remaining = unrankedCount(state);
  const total = game.items.length;
  const complete = total > 0 && remaining === 0;
  const untouched = remaining === total;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  // announce a move once the new state is committed
  useEffect(() => {
    const p = pendingAnnounce.current;
    if (!p) return;
    pendingAnnounce.current = null;
    const item = itemsById.get(p.itemId);
    if (!item) return;
    const idx = (state.placement[p.to] ?? []).indexOf(p.itemId);
    setLiveMsg(moveMessage(item.label, p.to, idx, unrankedCount(state)));
  }, [state, itemsById]);

  // return focus to a card after a non-drag move
  useEffect(() => {
    if (!focusItemId.current) return;
    const id = focusItemId.current;
    focusItemId.current = null;
    document
      .querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)
      ?.focus();
  });

  function toggleSelect(itemId: string) {
    dispatch({
      type: "SELECT",
      itemId: state.selectedItemId === itemId ? null : itemId,
    });
  }

  function pickerMove(itemId: string, to: string) {
    pendingAnnounce.current = { itemId, to };
    focusItemId.current = itemId;
    dispatch({ type: "MOVE", itemId, to });
    dispatch({ type: "SELECT", itemId: null });
  }

  function reorder(
    itemId: string,
    container: string,
    index: number,
    direction: -1 | 1,
  ) {
    pendingAnnounce.current = { itemId, to: container };
    focusItemId.current = itemId;
    dispatch({ type: "MOVE", itemId, to: container, toIndex: index + direction });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    dispatch({ type: "SELECT", itemId: null });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const itemId = String(active.id);
    if (!findContainer(state, itemId)) return;

    const overId = String(over.id);
    let to: string;
    let toIndex: number | undefined;

    if (overId in state.placement) {
      to = overId; // dropped on a container's empty area -> append
    } else {
      const overContainer = findContainer(state, overId);
      if (!overContainer) return;
      to = overContainer;
      toIndex = state.placement[overContainer].indexOf(overId);
    }

    pendingAnnounce.current = { itemId, to };
    dispatch({ type: "MOVE", itemId, to, toIndex });
  }

  const selectedItem = state.selectedItemId
    ? itemsById.get(state.selectedItemId)
    : undefined;
  const selectedContainer = state.selectedItemId
    ? findContainer(state, state.selectedItemId)
    : null;

  const picker =
    selectedItem && selectedContainer ? (
      <MovePicker
        item={selectedItem}
        currentContainer={selectedContainer}
        tierConfig={game.tierConfig}
        onMove={(to) => pickerMove(selectedItem.id, to)}
        onClose={() => {
          focusItemId.current = selectedItem.id;
          dispatch({ type: "SELECT", itemId: null });
        }}
      />
    ) : null;

  const activeItem = activeId ? itemsById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p>
            {total === 0 ? (
              <span className="text-sm text-muted">No items to rank.</span>
            ) : complete ? (
              <span className="font-display text-lg font-extrabold text-foreground">
                All {total} ranked{" "}
                <span className="text-tier-c" aria-hidden>
                  ✓
                </span>
              </span>
            ) : (
              <span className="text-muted">
                <span className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                  {remaining}
                </span>{" "}
                <span className="text-sm">left to rank</span>
              </span>
            )}
          </p>
          {untouched && total > 0 ? (
            <p className="text-xs text-muted">
              Drag a card into a tier, or tap it to pick one.
            </p>
          ) : null}
        </div>

        <RankingContainer
          id={UNRANKED}
          variant="pool"
          label="Unranked"
          itemIds={state.placement[UNRANKED]}
          itemsById={itemsById}
          selectedItemId={state.selectedItemId}
          pickerSlot={picker}
          renderItem={(item, index) => (
            <SortableItem
              key={item.id}
              item={item}
              containerId={UNRANKED}
              index={index}
              count={state.placement[UNRANKED].length}
              selected={state.selectedItemId === item.id}
              onToggleSelect={() => toggleSelect(item.id)}
              onReorder={(d) => reorder(item.id, UNRANKED, index, d)}
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          {game.tierConfig.map((tier) => (
            <RankingContainer
              key={tier}
              id={tier}
              variant="tier"
              label={tier}
              itemIds={state.placement[tier]}
              itemsById={itemsById}
              selectedItemId={state.selectedItemId}
              pickerSlot={picker}
              renderItem={(item, index) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  containerId={tier}
                  index={index}
                  count={state.placement[tier].length}
                  selected={state.selectedItemId === item.id}
                  onToggleSelect={() => toggleSelect(item.id)}
                  onReorder={(d) => reorder(item.id, tier, index, d)}
                />
              )}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
        {activeItem ? (
          <RankableCard
            item={activeItem}
            state="overlay"
            className="max-w-[13rem] rotate-2 scale-[1.03] cursor-grabbing"
          />
        ) : null}
      </DragOverlay>

      <div
        aria-live="polite"
        role="status"
        aria-label="Ranking updates"
        className="sr-only"
      >
        {liveMsg}
      </div>
    </DndContext>
  );
}
