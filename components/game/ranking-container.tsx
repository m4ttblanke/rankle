"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Fragment, type ReactNode } from "react";
import type { GameItem } from "@/lib/game/schema";
import { tierStyle } from "./tier-style";

type Props = {
  id: string;
  variant: "pool" | "tier";
  /** "Unranked" for the pool, otherwise the tier label (may be custom) */
  label: string;
  itemIds: string[];
  itemsById: Map<string, GameItem>;
  renderItem: (item: GameItem, index: number) => ReactNode;
  /** the move picker; rendered right after the selected card in this container */
  selectedItemId: string | null;
  pickerSlot: ReactNode;
};

/**
 * A droppable container used for BOTH the unranked pool and every tier lane.
 * A tier lane carries a whisper of its own colour (`tierStyle(label).lane`) so
 * the board reads as a board, not a table; the pool is a distinctly plainer
 * holding area. Standard S–D get their palette; custom tier labels get a
 * functional neutral treatment.
 */
export function RankingContainer({
  id,
  variant,
  label,
  itemIds,
  itemsById,
  renderItem,
  selectedItemId,
  pickerSlot,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { containerId: id } });
  const isPool = variant === "pool";
  const st = tierStyle(isPool ? "" : label);

  const list = (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
      <ul
        ref={setNodeRef}
        aria-label={isPool ? "Unranked items" : `Tier ${label}`}
        className={`flex min-h-14 flex-wrap content-start gap-2 rounded-xl p-2 transition-[background-color,box-shadow] ${
          isPool
            ? "border border-dashed border-border bg-surface-muted"
            : isOver
              ? st.laneOver
              : `${st.lane} ring-1 ring-inset ring-border/60`
        }`}
      >
        {itemIds.length === 0 ? (
          <li className="list-none self-center px-1.5 py-1.5 text-xs text-muted">
            {isPool ? "Everything is ranked" : "Empty"}
          </li>
        ) : null}
        {itemIds.map((itemId, index) => {
          const item = itemsById.get(itemId);
          if (!item) return null;
          return (
            <Fragment key={itemId}>
              {renderItem(item, index)}
              {itemId === selectedItemId && pickerSlot ? (
                <li className="w-full list-none">{pickerSlot}</li>
              ) : null}
            </Fragment>
          );
        })}
      </ul>
    </SortableContext>
  );

  if (isPool) {
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-1.5">
        <h2
          id={`${id}-heading`}
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Unranked · {itemIds.length}
        </h2>
        {list}
      </section>
    );
  }

  return (
    <section aria-label={`Tier ${label}`} className="flex items-stretch gap-2">
      <span
        className={`grid min-h-14 w-12 shrink-0 place-items-center rounded-xl border-2 font-display text-xl font-extrabold ${st.chip}`}
      >
        <span className="sr-only">Tier </span>
        {label}
      </span>
      <div className="min-w-0 flex-1">{list}</div>
    </section>
  );
}
