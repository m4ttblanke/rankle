import type { DailyGame } from "@/lib/game/schema";
import { RankableCard } from "./rankable-card";

/**
 * The tier board — the product's visual centre (docs/DESIGN.md sec 2, sec 12).
 *
 * Milestone 1 renders it read-only: every item sits in the line-up and the tier
 * lanes are empty and ready. Drag-and-drop and the non-drag tier picker arrive
 * in the next milestone.
 *
 * Tier identity is conveyed by the tier LETTER plus a `--tier-*-border` outline,
 * never by fill colour alone (sec 24). Standard S–D tiers get their palette;
 * any custom tier label falls back to a neutral treatment.
 */

const TIER_CHIP: Record<string, string> = {
  S: "bg-tier-s text-tier-s-foreground border-tier-s-border",
  A: "bg-tier-a text-tier-a-foreground border-tier-a-border",
  B: "bg-tier-b text-tier-b-foreground border-tier-b-border",
  C: "bg-tier-c text-tier-c-foreground border-tier-c-border",
  D: "bg-tier-d text-tier-d-foreground border-tier-d-border",
};
const TIER_CHIP_FALLBACK =
  "bg-surface-muted text-foreground border-border";

export function TierBoard({ game }: { game: DailyGame }) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="lineup-heading" className="flex flex-col gap-2">
        <h2
          id="lineup-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Line-up · {game.items.length} items
        </h2>
        {game.items.length > 0 ? (
          <ul
            aria-labelledby="lineup-heading"
            className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-muted p-2"
          >
            {game.items.map((item) => (
              <RankableCard key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
            This game has no items yet.
          </p>
        )}
      </section>

      <ol className="flex flex-col gap-2">
        {game.tierConfig.map((tier) => {
          const chip = TIER_CHIP[tier.toUpperCase()] ?? TIER_CHIP_FALLBACK;
          return (
            <li
              key={tier}
              className="flex items-stretch gap-2 rounded-lg border border-border bg-surface"
            >
              <span
                className={`grid min-h-16 w-14 shrink-0 place-items-center rounded-md border-2 font-display text-2xl font-extrabold ${chip}`}
              >
                <span className="sr-only">Tier </span>
                {tier}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-2 p-2">
                <span className="text-xs text-muted">Empty</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
