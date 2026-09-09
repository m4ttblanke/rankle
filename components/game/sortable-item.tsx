"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent, PointerEvent } from "react";
import { UNRANKED } from "@/lib/game/ranking";
import type { GameItem } from "@/lib/game/schema";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";
import { RankableCard } from "./rankable-card";

const stopPointer = (e: PointerEvent) => e.stopPropagation();

type Props = {
  item: GameItem;
  containerId: string;
  index: number;
  /** number of items in this container (for reorder bounds) */
  count: number;
  selected: boolean;
  onToggleSelect: () => void;
  onReorder: (direction: -1 | 1) => void;
};

/**
 * One rankable item wired to dnd-kit. The whole card is the pointer drag
 * surface; a plain click / Enter / Space opens the tier picker instead (no
 * keyboard drag sensor — the picker is the first-class non-drag path). Reorder
 * controls appear only while the item is selected and sitting in a tier.
 */
export function SortableItem({
  item,
  containerId,
  index,
  count,
  selected,
  onToggleSelect,
  onReorder,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { containerId, index } });

  const inTier = containerId !== UNRANKED;
  const state = isDragging ? "dragging" : selected ? "selected" : "idle";

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleSelect();
    }
  }

  return (
    <li className="max-w-[13rem] flex-1 basis-[8.5rem] list-none">
      <RankableCard
        ref={setNodeRef}
        item={item}
        state={state}
        tierKey={inTier ? containerId : undefined}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-roledescription={undefined}
        aria-describedby={undefined}
        aria-haspopup="menu"
        aria-expanded={selected}
        aria-label={`${item.label} — ${inTier ? `tier ${containerId}` : "unranked"}. Activate to choose a tier.`}
        onClick={onToggleSelect}
        onKeyDown={onKeyDown}
        className={selected ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
      >
        {inTier && selected ? (
          <span
            className="ml-1 flex shrink-0 items-center gap-0.5"
            onPointerDown={stopPointer}
          >
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(-1);
              }}
              className="grid size-7 place-items-center rounded-md border border-border text-muted enabled:hover:text-foreground disabled:opacity-30"
            >
              <ChevronUpIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              disabled={index >= count - 1}
              onClick={(e) => {
                e.stopPropagation();
                onReorder(1);
              }}
              className="grid size-7 place-items-center rounded-md border border-border text-muted enabled:hover:text-foreground disabled:opacity-30"
            >
              <ChevronDownIcon className="size-4" />
            </button>
          </span>
        ) : null}
      </RankableCard>
    </li>
  );
}
