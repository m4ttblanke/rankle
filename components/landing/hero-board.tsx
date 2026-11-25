import type { CSSProperties } from "react";
import { tierStyle } from "@/components/game/tier-style";

/**
 * The landing hero's visual (docs/DESIGN.md sec 20): an EMPTY tier board with
 * a few of today's items hovering around it, one of them drifting toward the
 * board and back — "a ranking in progress," never a completed or
 * authoritative answer. Nothing here is ever placed in a tier.
 *
 * Purely decorative (`aria-hidden`): the hero copy next to it already names
 * today's topic, so a screen reader loses nothing. Item labels are the same
 * pre-submission data `/play` already shows anyone. Motion is CSS-transform
 * only (`rankle-bob` / `rankle-drop` in `app/globals.css`) and is frozen by
 * the global `prefers-reduced-motion` rule.
 */

const TIERS = ["S", "A", "B", "C", "F", "N/A"];

type Floater = {
  className: string;
  style: CSSProperties;
  motion: "bob" | "drop";
  tone: string;
  /** monogram square fill */
  mono: string;
};

// Positions are inside the composition's own padded box so nothing can push
// the page wider than the viewport on a 320px screen.
const FLOATERS: Floater[] = [
  {
    className: "left-0 top-1",
    style: { "--r": "-7deg", animationDelay: "0s" } as CSSProperties,
    motion: "bob",
    tone: "bg-brand-pink text-ink",
    mono: "bg-surface",
  },
  {
    className: "right-0 top-[38%]",
    style: { "--r": "6deg", animationDelay: "-1.6s" } as CSSProperties,
    motion: "bob",
    tone: "bg-brand-yellow text-ink",
    mono: "bg-surface",
  },
  {
    className: "bottom-0 left-[6%]",
    style: {
      "--r": "-4deg",
      "--dx": "28px",
      "--dy": "-96px",
    } as CSSProperties,
    motion: "drop",
    tone: "bg-surface text-ink",
    mono: "bg-brand-yellow",
  },
  {
    className: "right-[4%] bottom-2",
    style: { "--r": "9deg", animationDelay: "-3s" } as CSSProperties,
    motion: "bob",
    tone: "bg-surface text-ink",
    mono: "bg-brand-blue",
  },
];

export function HeroBoard({ labels }: { labels: string[] }) {
  const cards = FLOATERS.map((f, i) => ({
    ...f,
    label: labels[i] ?? ["Your pick", "Hot take", "Guilty pleasure", "Overrated"][i],
  }));

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none px-3 py-14 sm:px-8">
      <div className="rounded-xl border-2 border-ink bg-surface p-2.5 shadow-[6px_6px_0_0_var(--ink)]">
        <div className="flex flex-col gap-1.5">
          {TIERS.map((tier) => {
            const st = tierStyle(tier);
            return (
              <div key={tier} className="flex items-stretch gap-1.5">
                <span
                  className={`grid h-9 w-11 shrink-0 place-items-center rounded-md border-2 border-ink font-display text-sm font-extrabold ${st.chip.replace(/border-\S+/, "")}`}
                >
                  {tier}
                </span>
                <span
                  className={`flex-1 rounded-md border border-dashed border-ink/25 ${st.lane}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {cards.map((card) => (
        <span
          key={card.label + card.className}
          style={card.style}
          className={`${card.motion === "drop" ? "rankle-drop" : "rankle-bob"} absolute ${card.className} flex max-w-[9.5rem] items-center gap-2 rounded-lg border-2 border-ink px-2.5 py-2 shadow-[3px_3px_0_0_var(--ink)] ${card.tone}`}
        >
          <span className={`grid size-6 shrink-0 place-items-center rounded-sm border-2 border-ink ${card.mono} font-display text-xs font-extrabold text-ink`}>
            {card.motion === "drop" ? "?" : card.label.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-display text-sm font-bold leading-tight">
            {card.label}
          </span>
        </span>
      ))}
    </div>
  );
}
