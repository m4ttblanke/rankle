import Image from "next/image";
import type { GameItem } from "@/lib/game/schema";

/**
 * A single rankable item. Read-only in Milestone 1 (no drag / no tier picker
 * yet) — it renders the item's identity only. Label is always shown as text so
 * the item is never identified by image alone (docs/DESIGN.md sec 13, sec 31).
 */
export function RankableCard({ item }: { item: GameItem }) {
  return (
    <li className="flex w-[calc(50%-0.25rem)] items-center gap-2.5 rounded-lg border border-border bg-surface p-2 sm:w-auto sm:max-w-[15rem]">
      <span
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-muted text-sm font-semibold text-muted"
        aria-hidden={item.imageUrl ? undefined : true}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            width={40}
            height={40}
            className="size-full object-cover"
          />
        ) : (
          item.label.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 text-sm font-medium leading-tight text-foreground">
        {item.label}
      </span>
    </li>
  );
}
