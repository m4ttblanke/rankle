import { tierStyle } from "@/components/game/tier-style";
import {
  NA_TIER,
  communityTierForAvg,
  consensusControversy,
  itemDistribution,
  tierWeight,
} from "@/lib/game/results";
import type { MyRankingEntry, ResultsItem } from "@/lib/game/results-schema";
import { DistributionBar } from "./distribution-bar";

type Props = {
  myRanking: MyRankingEntry[];
  items: ResultsItem[];
  tierConfig: string[];
  totalSubmissions: number;
};

/** Interpretive label for a scored item's controversy score — only ever shown
 *  when `!insufficientData` (docs/MANUAL.md sec 10). */
function verdictLabel(controversy: number): string {
  if (controversy < 0.25) return "Strong consensus";
  if (controversy < 0.6) return "Mixed opinions";
  return "Controversial";
}

/**
 * Your submitted placement next to the community's, item by item — the
 * "prioritize comparison over analytics dashboard" section of the results
 * page (M4 brief). Ordered the way the player actually ranked it: S..F by
 * weight then position, with N/A placements shown afterward under their own
 * neutral heading rather than sorted in as if N/A were simply "below F".
 */
export function ComparisonList({
  myRanking,
  items,
  tierConfig,
  totalSubmissions,
}: Props) {
  const itemsById = new Map(items.map((i) => [i.itemId, i]));

  const opinionEntries = myRanking
    .filter((e) => e.tier !== NA_TIER)
    .sort((a, b) => {
      const diff = tierWeight(tierConfig, b.tier) - tierWeight(tierConfig, a.tier);
      return diff !== 0 ? diff : a.position - b.position;
    });
  const naEntries = myRanking
    .filter((e) => e.tier === NA_TIER)
    .sort((a, b) => a.position - b.position);

  function row(entry: MyRankingEntry) {
    const item = itemsById.get(entry.itemId);
    if (!item) return null;

    const myStyle = tierStyle(entry.tier);
    const communityTier =
      item.avgWeight !== null ? communityTierForAvg(tierConfig, item.avgWeight) : null;
    const communityStyle = communityTier ? tierStyle(communityTier) : null;
    const distribution = itemDistribution(item, tierConfig, totalSubmissions);
    const verdict = consensusControversy(item, tierConfig);

    return (
      <li
        key={item.itemId}
        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
      >
        <div className="flex items-center gap-2">
          <span
            title={`Your tier: ${entry.tier}`}
            className={`grid size-8 shrink-0 place-items-center rounded-md border-2 font-display text-sm font-extrabold ${myStyle.chip}`}
          >
            {entry.tier}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {item.label}
          </span>
          {communityStyle && communityTier ? (
            <span
              title={`Community: ${communityTier}`}
              className={`grid size-8 shrink-0 place-items-center rounded-md border-2 font-display text-sm font-extrabold ${communityStyle.chip}`}
            >
              {communityTier}
            </span>
          ) : (
            <span className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
              Unrated
            </span>
          )}
        </div>
        <DistributionBar distribution={distribution} />
        {verdict.consensus !== null ? (
          <p className="text-xs text-muted">
            {verdict.insufficientData
              ? "Not enough ratings yet"
              : verdictLabel(verdict.controversy)}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">{opinionEntries.map(row)}</ul>
      {naEntries.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Haven&rsquo;t tried
          </p>
          <ul className="flex flex-col gap-2">{naEntries.map(row)}</ul>
        </div>
      ) : null}
    </div>
  );
}
