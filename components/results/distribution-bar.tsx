import { tierStyle } from "@/components/game/tier-style";
import type { ItemDistribution } from "@/lib/game/results";

/**
 * An item's S/A/B/C/F distribution as a segmented bar, plus a separately
 * rendered "haven't tried" line. N/A is never appended to the same bar as a
 * trailing segment — that would read as a sixth, worse-than-F quality level
 * (docs/MANUAL.md sec 9; the M4 brief's ITEM DISTRIBUTIONS section).
 *
 * The bar is decorative (`aria-hidden`); the counts next to it are the real,
 * always-visible content, so nothing here depends on color alone.
 */
export function DistributionBar({
  distribution,
}: {
  distribution: ItemDistribution;
}) {
  const { scored, naCount, naPct, n } = distribution;

  return (
    <div className="flex flex-col gap-1">
      {n > 0 ? (
        <div
          aria-hidden
          className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          {scored.map(({ tier, pct }) =>
            pct > 0 ? (
              <span
                key={tier}
                style={{ width: `${pct * 100}%` }}
                className={tierStyle(tier).chip.split(" ")[0]}
              />
            ) : null,
          )}
        </div>
      ) : null}
      <p className="flex flex-wrap gap-x-2 text-xs text-muted">
        {n > 0 ? (
          scored.map(({ tier, count }) => (
            <span key={tier}>
              {tier} {count}
            </span>
          ))
        ) : (
          <span>No ratings yet</span>
        )}
      </p>
      {naCount > 0 ? (
        <p className="text-xs text-muted">
          {Math.round(naPct * 100)}% haven&rsquo;t tried it
        </p>
      ) : null}
    </div>
  );
}
