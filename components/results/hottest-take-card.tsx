import { tierStyle } from "@/components/game/tier-style";
import type { HottestTake } from "@/lib/game/results";

/**
 * The single biggest disagreement between the player's submitted placement
 * and community opinion — the "interesting disagreement" beat of the results
 * reveal. Shows a graceful insufficient-data state instead of manufacturing a
 * take when nothing clears the thresholds (M4 brief, HOTTEST TAKE section).
 */
export function HottestTakeCard({ take }: { take: HottestTake }) {
  if (take.kind === "none") {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted">
        No hot take yet — not enough community data to call out a real
        disagreement.
      </p>
    );
  }

  const myStyle = tierStyle(take.myTier);
  const verb = take.direction === "higher" ? "higher" : "lower";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/[0.05] p-4">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-md border-2 font-display text-lg font-extrabold ${myStyle.chip}`}
      >
        {take.myTier}
      </span>
      <p className="text-sm text-foreground">
        You ranked <span className="font-semibold">{take.label}</span>{" "}
        {verb} than everyone else — a full {take.diff}{" "}
        {take.diff === 1 ? "tier" : "tiers"} off the community average.
      </p>
    </div>
  );
}
