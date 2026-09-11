import type { GameResults, MyRankingEntry, ResultsItem } from "./results-schema";

/**
 * Pure, DB-free result calculations (Milestone 4). Everything here operates on
 * `GameResults` (already fetched + spoiler-gated by `get-results.ts`) and a
 * game's `tierConfig`. No Supabase import, no charting library — plain numbers
 * the UI turns into tier chips and CSS bars.
 *
 * `avg_weight` / `n` are DB-sourced and stay the one source of truth for the
 * scored average and sample size (see `submit_ranking`'s aggregate step) —
 * nothing here recomputes them from `tier_counts`. What lives here is
 * everything the RPC deliberately leaves to the application layer: which tier
 * an average lands in, consensus/controversy, and the hottest take.
 *
 * -- N/A is a scale value, not a low opinion --
 * Every function below treats "N/A" as excluded by IDENTITY (`tier === NA_TIER`
 * / `tier !== NA_TIER`), never by position (e.g. "the last tier_config entry").
 * The canonical scale happens to put N/A last today, but nothing here assumes
 * that — a hypothetical future tier_config with N/A anywhere else would behave
 * identically.
 */

export const NA_TIER = "N/A";

/** Below this many scored responses, a consensus/controversy verdict (or the
 *  game-wide "how many people have played" framing) is not shown as
 *  authoritative — see docs/MANUAL.md sec 10. */
export const MIN_RESPONSES_FOR_VERDICT = 3;

/** An item needs at least this many scored responses to be a hottest-take
 *  candidate — i.e. at least one opinion besides the player's own. */
export const HOTTEST_TAKE_MIN_RESPONSES = 2;

/** Minimum |player weight - community average weight| (in whole-tier units)
 *  to count as a "meaningful" disagreement. */
export const HOTTEST_TAKE_MIN_DIFF = 1;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Every `tierConfig` entry except "N/A", in their original relative order
 *  (S..F for the canonical scale). Identity-based exclusion, not positional. */
export function opinionTiers(tierConfig: string[]): string[] {
  return tierConfig.filter((t) => t !== NA_TIER);
}

/**
 * Position-based weight, mirroring `private.tier_weight` exactly: the first
 * `tierConfig` entry gets `tierConfig.length`, decreasing by one per position.
 * "N/A" always returns 0 — checked by identity first, so this can never
 * silently hand N/A a numeric weight even if it weren't the last entry.
 */
export function tierWeight(tierConfig: string[], tier: string): number {
  if (tier === NA_TIER) return 0;
  const idx = tierConfig.indexOf(tier);
  if (idx === -1) return 0;
  return tierConfig.length - idx;
}

/**
 * The opinion tier whose weight is nearest `avgWeight`. On an exact tie
 * (avgWeight sits precisely between two tiers' weights), the HIGHER tier
 * wins — implemented as an explicit distance comparison rather than
 * `Math.round`, so the tie-break direction is a documented, tested decision
 * rather than an accident of rounding semantics.
 */
export function communityTierForAvg(
  tierConfig: string[],
  avgWeight: number,
): string {
  const tiers = opinionTiers(tierConfig);
  let best = tiers[0];
  let bestWeight = tierWeight(tierConfig, best);
  let bestDist = Math.abs(bestWeight - avgWeight);

  for (const tier of tiers.slice(1)) {
    const weight = tierWeight(tierConfig, tier);
    const dist = Math.abs(weight - avgWeight);
    if (dist < bestDist || (dist === bestDist && weight > bestWeight)) {
      best = tier;
      bestWeight = weight;
      bestDist = dist;
    }
  }
  return best;
}

export type CommunityTierRow = { tier: string; items: ResultsItem[] };
export type CommunityTierList = {
  rows: CommunityTierRow[];
  /** Items with zero scored responses — never forced into F. */
  unrated: ResultsItem[];
};

/**
 * The community's aggregate tier list: one row per opinion tier (S..F, in
 * `tierConfig` order), plus a separate `unrated` bucket for items nobody has
 * scored yet. Within a row, items sort by `avgWeight` descending, ties broken
 * by the game's own `sortOrder` — deterministic regardless of DB row order.
 */
export function communityTierList(
  items: ResultsItem[],
  tierConfig: string[],
): CommunityTierList {
  const tiers = opinionTiers(tierConfig);
  const byTier = new Map<string, ResultsItem[]>(tiers.map((t) => [t, []]));
  const unrated: ResultsItem[] = [];

  for (const item of items) {
    if (item.avgWeight === null) {
      unrated.push(item);
      continue;
    }
    const tier = communityTierForAvg(tierConfig, item.avgWeight);
    byTier.get(tier)?.push(item);
  }

  for (const list of byTier.values()) {
    list.sort((a, b) => {
      const diff = (b.avgWeight as number) - (a.avgWeight as number);
      return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
    });
  }
  unrated.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    rows: tiers.map((tier) => ({ tier, items: byTier.get(tier) ?? [] })),
    unrated,
  };
}

export type ItemDistribution = {
  itemId: string;
  /** Opinion tiers only, in `tierConfig` order — count + share of `n`. */
  scored: { tier: string; count: number; pct: number }[];
  naCount: number;
  /** naCount / totalSubmissions (the whole game's completed-submission count)
   *  — deliberately NOT naCount / n. See docs/MANUAL.md sec 9. */
  naPct: number;
  n: number;
  avgWeight: number | null;
};

/** Per-item S/A/B/C/F distribution plus a separately-tracked N/A share. */
export function itemDistribution(
  item: ResultsItem,
  tierConfig: string[],
  totalSubmissions: number,
): ItemDistribution {
  const tiers = opinionTiers(tierConfig);
  const scored = tiers.map((tier) => {
    const count = item.tierCounts[tier] ?? 0;
    return { tier, count, pct: item.n > 0 ? count / item.n : 0 };
  });
  const naCount = item.tierCounts[NA_TIER] ?? 0;
  const naPct = totalSubmissions > 0 ? naCount / totalSubmissions : 0;
  return { itemId: item.itemId, scored, naCount, naPct, n: item.n, avgWeight: item.avgWeight };
}

export type ConsensusResult =
  // unrated (n === 0): nothing to score, not merely "low confidence".
  | { n: number; consensus: null; controversy: null; insufficientData: true }
  // scored: numbers always defined; `insufficientData` gates whether the UI
  // should present the number as an authoritative label (n < MIN_RESPONSES_FOR_VERDICT)
  // or fall back to "Not enough ratings yet" — the raw distribution counts stay
  // visible either way (docs/MANUAL.md sec 10).
  | { n: number; consensus: number; controversy: number; insufficientData: boolean };

/**
 * Consensus/controversy from the variance of SCORED tier weights around
 * `avgWeight`, normalized by the maximum possible variance for the scale (a
 * 50/50 split at the two weight extremes). `controversy` rises with spread;
 * `consensus = 1 - controversy`. N/A never enters the sum. Deterministic, no
 * statistics beyond a bounded variance — see docs/MANUAL.md sec 10.
 */
export function consensusControversy(
  item: ResultsItem,
  tierConfig: string[],
): ConsensusResult {
  const n = item.n;
  if (n === 0 || item.avgWeight === null) {
    return { n, consensus: null, controversy: null, insufficientData: true };
  }

  const tiers = opinionTiers(tierConfig);
  const weights = tiers.map((t) => tierWeight(tierConfig, t));
  const mean = item.avgWeight;

  let sumSquares = 0;
  for (const tier of tiers) {
    const count = item.tierCounts[tier] ?? 0;
    const weight = tierWeight(tierConfig, tier);
    sumSquares += count * (weight - mean) ** 2;
  }
  const variance = sumSquares / n;

  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const maxVariance = ((maxWeight - minWeight) / 2) ** 2;
  const controversy = maxVariance > 0 ? clamp01(variance / maxVariance) : 0;

  return {
    n,
    consensus: 1 - controversy,
    controversy,
    insufficientData: n < MIN_RESPONSES_FOR_VERDICT,
  };
}

export type HottestTake =
  | { kind: "none" }
  | {
      kind: "found";
      itemId: string;
      label: string;
      imageUrl: string | null;
      myTier: string;
      myWeight: number;
      avgWeight: number;
      diff: number;
      /** Did the player rate it higher or lower than the community average? */
      direction: "higher" | "lower";
    };

/**
 * The submitted S/A/B/C/F placement that differs most from community opinion.
 * "N/A" placements are ineligible outright. An item only becomes a candidate
 * once it has HOTTEST_TAKE_MIN_RESPONSES scored responses (so the comparison
 * reflects at least one opinion besides the player's own — when the player is
 * the sole scored response, avgWeight equals their own weight exactly, so
 * diff is 0 and HOTTEST_TAKE_MIN_DIFF excludes it regardless) and the
 * difference must clear HOTTEST_TAKE_MIN_DIFF. Ties break by the item's
 * `sortOrder`. No eligible candidate -> `{ kind: "none" }`.
 */
export function hottestTake(
  myRanking: MyRankingEntry[],
  items: ResultsItem[],
  tierConfig: string[],
): HottestTake {
  const itemsById = new Map(items.map((i) => [i.itemId, i]));
  let best: Extract<HottestTake, { kind: "found" }> | null = null;
  let bestSortOrder = Infinity;

  for (const entry of myRanking) {
    if (entry.tier === NA_TIER) continue;
    const item = itemsById.get(entry.itemId);
    if (!item || item.avgWeight === null) continue;
    if (item.n < HOTTEST_TAKE_MIN_RESPONSES) continue;

    const myWeight = tierWeight(tierConfig, entry.tier);
    const diff = Math.abs(myWeight - item.avgWeight);
    if (diff < HOTTEST_TAKE_MIN_DIFF) continue;

    const beatsCurrent =
      best === null ||
      diff > best.diff ||
      (diff === best.diff && item.sortOrder < bestSortOrder);

    if (beatsCurrent) {
      best = {
        kind: "found",
        itemId: item.itemId,
        label: item.label,
        imageUrl: item.imageUrl,
        myTier: entry.tier,
        myWeight,
        avgWeight: item.avgWeight,
        diff,
        direction: myWeight > item.avgWeight ? "higher" : "lower",
      };
      bestSortOrder = item.sortOrder;
    }
  }

  return best ?? { kind: "none" };
}

/** Convenience: is there enough game-wide data to frame results with
 *  confidence, or should the UI show an "Early results" banner? */
export function isEarlyResults(results: GameResults): boolean {
  return results.totalSubmissions < MIN_RESPONSES_FOR_VERDICT;
}
