import { z } from "zod";

/**
 * Trust-boundary schema + result types for official submission (Milestone 3).
 *
 * The Server Action validates only the *shape* of what the browser sent. The
 * database RPC `submit_ranking` remains the sole authority for the semantic
 * rules — game is open, every item of this game appears exactly once, tiers and
 * positions are valid, one submission per identity, transactional aggregates
 * (docs/SECURITY.md sec 12). We do not re-implement those here; a second
 * validator that could disagree with the database is a liability, not a
 * safeguard.
 */

// Postgres uuid text form (same shape the game read path accepts).
const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

/** One placed item, exactly as `submit_ranking`'s `p_items` elements. */
export const submissionItemSchema = z
  .object({
    item_id: uuid,
    tier: z.string().min(1).max(8),
    position: z.number().int().nonnegative(),
  })
  .strict();

/** What the client is allowed to send to the submit Server Action. The guest
 *  identity is NOT part of this — it comes only from the signed cookie. */
export const submitRankingInputSchema = z
  .object({
    tierlistId: uuid,
    items: z.array(submissionItemSchema).min(1),
  })
  .strict();

export type SubmissionItem = z.infer<typeof submissionItemSchema>;
export type SubmitRankingInput = z.infer<typeof submitRankingInputSchema>;

/**
 * Narrow, non-leaky result handed back to the UI. No raw database text, no
 * stack traces (docs/SECURITY.md sec 22).
 *
 * - `already`  — this identity already has an official submission (treated as a
 *                locked state, never as an error the user must fix).
 * - `invalid`  — the payload was rejected (shape here, or a semantic rule in the
 *                RPC). The local ranking is preserved so the player can retry.
 * - `closed`   — the game is not open for submissions.
 * - `network`  — transport / unexpected server failure. Ranking preserved.
 */
export type SubmitRankingResult =
  | { ok: true }
  | { ok: false; reason: "already" | "invalid" | "closed" | "network" };
