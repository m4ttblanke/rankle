import Image from "next/image";
import type { ComponentPropsWithRef, ReactNode } from "react";
import type { GameItem } from "@/lib/game/schema";
import { tierStyle } from "./tier-style";

/**
 * Presentational rankable item — a tactile tile, not a form row. The label is
 * always text so an item is never identified by image alone (docs/DESIGN.md
 * sec 13, sec 31). When it sits in a tier, the monogram becomes that tier's
 * badge and a left bar picks up the tier colour, so placements read at a glance
 * — always alongside the tier letter, never colour alone.
 */

export type CardState = "idle" | "selected" | "dragging" | "overlay";

const STATE_CLASS: Record<CardState, string> = {
  idle: "border-border bg-surface shadow-xs active:scale-[0.98]",
  selected:
    "relative z-10 border-accent bg-surface shadow-sm ring-2 ring-accent/50",
  dragging: "border-dashed border-border bg-surface-muted/60 opacity-50",
  overlay: "border-border bg-surface shadow-lg",
};

type Props = ComponentPropsWithRef<"div"> & {
  item: GameItem;
  state?: CardState;
  /** tier label when the card sits in a tier; undefined in the pool */
  tierKey?: string;
  /** move controls, rendered after the label */
  children?: ReactNode;
};

export function RankableCard({
  item,
  state = "idle",
  tierKey,
  children,
  className = "",
  ...rest
}: Props) {
  const st = tierKey ? tierStyle(tierKey) : null;
  const ranked = Boolean(st) && state !== "overlay";

  return (
    <div
      {...rest}
      data-card-id={item.id}
      title={item.label}
      className={`flex w-full select-none items-center gap-2.5 rounded-lg border py-2 pr-2 outline-none transition-transform [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-accent ${
        ranked ? `border-l-[3px] ${st!.bar} pl-2` : "pl-2.5"
      } ${STATE_CLASS[state]} ${className}`}
    >
      <span
        aria-hidden={item.imageUrl ? undefined : true}
        className={`grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border font-display text-sm font-extrabold ${
          ranked
            ? st!.chip
            : "border-transparent bg-surface-muted text-muted"
        }`}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            width={36}
            height={36}
            className="size-full object-cover"
          />
        ) : (
          item.label.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-tight text-foreground">
        {item.label}
      </span>
      {children}
    </div>
  );
}
