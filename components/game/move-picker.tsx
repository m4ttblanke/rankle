"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { UNRANKED } from "@/lib/game/ranking";
import type { GameItem } from "@/lib/game/schema";
import { CloseIcon } from "./icons";
import { tierStyle } from "./tier-style";

type Props = {
  item: GameItem;
  currentContainer: string;
  tierConfig: string[];
  onMove: (to: string) => void;
  onClose: () => void;
};

/**
 * The single non-drag ranking control. Appears right after the selected card on
 * every viewport (minimal pointer/thumb travel — the card you just tapped is
 * adjacent). Tap / click / keyboard all call the same `onMove`, which the board
 * routes through the one `MOVE` dispatch. Escape closes.
 */
export function MovePicker({
  item,
  currentContainer,
  tierConfig,
  onMove,
  onClose,
}: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      role="group"
      aria-label={`Move ${item.label}`}
      onKeyDown={onKeyDown}
      className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/40 bg-surface p-2 shadow-sm"
    >
      <span className="mr-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Move to
      </span>

      {tierConfig.map((tier, i) => {
        const st = tierStyle(tier);
        const current = currentContainer === tier;
        return (
          <button
            key={tier}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            aria-label={`Tier ${tier}`}
            aria-current={current || undefined}
            onClick={() => onMove(tier)}
            className={`grid h-9 min-w-9 place-items-center rounded-md border-2 px-1.5 font-display font-extrabold ${
              tier.length > 1 ? "text-xs" : "text-base"
            } ${st.chip} ${
              current ? "ring-2 ring-foreground/40 ring-offset-1 ring-offset-surface" : ""
            }`}
          >
            <span aria-hidden>{tier}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-current={currentContainer === UNRANKED || undefined}
        onClick={() => onMove(UNRANKED)}
        className={`h-9 rounded-md border border-border bg-surface-muted px-2.5 text-xs font-semibold text-foreground ${
          currentContainer === UNRANKED ? "ring-2 ring-foreground/30" : ""
        }`}
      >
        Unranked
      </button>

      <button
        type="button"
        aria-label={`Close move menu for ${item.label}`}
        onClick={onClose}
        className="ml-auto grid size-8 place-items-center rounded-md text-muted hover:text-foreground"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
