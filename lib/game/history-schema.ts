import { z } from "zod";

/**
 * Validation + shaping for the current user's history reads (Milestone 6) —
 * same read-boundary discipline as `schema.ts` / `results-schema.ts`:
 * database constraints are the real authority, this just catches a
 * schema/query drift as a clear error instead of a malformed render.
 */

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

const tierlistRefSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  release_date: z.string().nullable(),
});

export const historySubmissionRowSchema = z.object({
  id: uuid,
  submitted_at: z.string().min(1),
  tierlists: tierlistRefSchema,
});

export const historyItemRowSchema = z.object({
  submission_id: uuid,
  tier: z.string().min(1).max(8),
});

export type HistoryEntry = {
  submissionId: string;
  tierlistSlug: string;
  tierlistTitle: string;
  releaseDate: string | null;
  submittedAt: string;
  /** This player's own placement counts for this game, e.g. {"S": 2, "F": 1}. */
  tierCounts: Record<string, number>;
};
