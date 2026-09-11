import { z } from "zod";

/**
 * Validation + shaping for the `get_results` RPC response (Milestone 4).
 *
 * `get_results` is SECURITY DEFINER and itself enforces the spoiler gate
 * (raises `42501` before the caller has an official submission) — this module
 * only re-validates the *shape* of what comes back once eligible, same
 * boundary discipline as `lib/game/schema.ts` for the daily-game read.
 */

// Postgres `uuid` text form — duplicated in each read-boundary module rather
// than shared, matching `lib/game/schema.ts` / `lib/game/submission.ts`.
const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

const tierlistSchema = z.object({
  id: uuid,
  slug: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().nullable(),
  tier_config: z.array(z.string().min(1).max(8)).min(2).max(8),
});

const resultsItemRowSchema = z.object({
  item_id: uuid,
  label: z.string().min(1),
  image_url: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
  // Dynamic per-tier occurrence counts, e.g. {"S": 2, "N/A": 1}. Keys are
  // whatever the game's tier_config contains — not re-validated against it
  // here, since this is read-only display data, not a trust boundary write.
  tier_counts: z.record(z.string(), z.number().int().nonnegative()),
  // SCORED submissions only (N/A excluded server-side; see migration
  // 20260910180000_na_tier_scale.sql). Never the game's total submission count.
  n: z.number().int().nonnegative(),
  sum_weight: z.number().int().nonnegative(),
  avg_weight: z.number().nullable(),
});

const myRankingRowSchema = z.object({
  item_id: uuid,
  tier: z.string().min(1).max(8),
  position: z.number().int().nonnegative(),
});

export const resultsResponseSchema = z.object({
  tierlist: tierlistSchema,
  // Count of rows in `submissions` for this game — every completed official
  // submission, regardless of what tiers they chose. This is the correct
  // denominator for "N/A %", NOT any per-item `n`.
  total_submissions: z.number().int().nonnegative(),
  items: z.array(resultsItemRowSchema),
  my_ranking: z.array(myRankingRowSchema),
  // Milestone 5: the caller's own submission id, returned only after this
  // caller already passed get_results()'s eligibility gate (see migration
  // 20260911190000_get_results_submission_id.sql). Used solely to call
  // create_share() — never rendered, never put in a URL or outbound share
  // text (docs/SECURITY.md sec 8, sec 9).
  submission_id: uuid,
});

export type ResultsItem = {
  itemId: string;
  label: string;
  imageUrl: string | null;
  sortOrder: number;
  tierCounts: Record<string, number>;
  n: number;
  sumWeight: number;
  avgWeight: number | null;
};

export type MyRankingEntry = {
  itemId: string;
  tier: string;
  position: number;
};

export type GameResults = {
  tierlist: {
    id: string;
    slug: string;
    title: string;
    prompt: string | null;
    tierConfig: string[];
  };
  totalSubmissions: number;
  items: ResultsItem[];
  myRanking: MyRankingEntry[];
  /** This caller's own submission id — internal use only (create_share). Not
   *  for display, not for URLs, not an authorization mechanism on its own. */
  submissionId: string;
};

/**
 * Validate a raw `get_results` payload and shape it into `GameResults`.
 * Throws `ZodError` if the payload does not match — that should only ever
 * happen on a schema/RPC drift, never on ordinary eligible/ineligible calls.
 */
export function mapResults(raw: unknown): GameResults {
  const parsed = resultsResponseSchema.parse(raw);
  return {
    tierlist: {
      id: parsed.tierlist.id,
      slug: parsed.tierlist.slug,
      title: parsed.tierlist.title,
      prompt: parsed.tierlist.prompt,
      tierConfig: parsed.tierlist.tier_config,
    },
    totalSubmissions: parsed.total_submissions,
    items: parsed.items.map((it) => ({
      itemId: it.item_id,
      label: it.label,
      imageUrl: it.image_url,
      sortOrder: it.sort_order,
      tierCounts: it.tier_counts,
      n: it.n,
      sumWeight: it.sum_weight,
      avgWeight: it.avg_weight,
    })),
    myRanking: parsed.my_ranking.map((r) => ({
      itemId: r.item_id,
      tier: r.tier,
      position: r.position,
    })),
    submissionId: parsed.submission_id,
  };
}
