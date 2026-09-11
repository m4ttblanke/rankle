import { z } from "zod";

/**
 * Validation + shaping for "today's game" data read from Supabase.
 *
 * The database already enforces these invariants (CHECK constraints, RLS). We
 * re-validate at the read boundary so a schema/data drift surfaces as a clear
 * error instead of a malformed render (docs/SECURITY.md sec 11).
 */

/**
 * Statuses that can be "today's game". `archived` is intentionally excluded:
 * archived games stay publicly readable (for the future archive feature) but are
 * never the active daily game.
 */
export const DAILY_GAME_STATUSES = ["scheduled", "live"] as const;

/** Columns the game screen reads, with items embedded. Shared by the resolver
 *  and its read-only integration test so they cannot drift. */
export const DAILY_GAME_SELECT =
  "id, slug, title, prompt, release_date, tier_config, tierlist_items(id, label, image_url, sort_order)";

// Postgres `uuid` text form — any hex-grouped value, not only RFC-4122 v4
// (games seeded with explicit ids are valid uuids but may not be v4).
const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

/** A daily game's tier configuration, e.g. ["S","A","B","C","F","N/A"]. */
export const tierConfigSchema = z
  .array(z.string().min(1).max(8))
  .min(2)
  .max(8);

/** Raw `tierlist_items` row (subset the game screen needs). */
export const gameItemRowSchema = z.object({
  id: uuid,
  label: z.string().min(1).max(120),
  image_url: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
});

/** Raw `tierlists` row with embedded items, as returned by the nested select. */
export const dailyGameRowSchema = z.object({
  id: uuid,
  slug: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().nullable(),
  release_date: z.string().min(1), // resolver only selects released games
  tier_config: tierConfigSchema,
  tierlist_items: z.array(gameItemRowSchema),
});

export type GameItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  sortOrder: number;
};

export type DailyGame = {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  releaseDate: string;
  tierConfig: string[];
  items: GameItem[];
};

/**
 * Validate a raw joined row and shape it into a `DailyGame`. Items are returned
 * sorted by `sort_order`. Throws `ZodError` if the row does not match.
 */
export function mapDailyGame(row: unknown): DailyGame {
  const parsed = dailyGameRowSchema.parse(row);
  return {
    id: parsed.id,
    slug: parsed.slug,
    title: parsed.title,
    prompt: parsed.prompt,
    releaseDate: parsed.release_date,
    tierConfig: parsed.tier_config,
    items: [...parsed.tierlist_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({
        id: it.id,
        label: it.label,
        imageUrl: it.image_url,
        sortOrder: it.sort_order,
      })),
  };
}
