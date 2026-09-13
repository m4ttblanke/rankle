import { z } from "zod";

/**
 * Validation for admin Server Action inputs (Milestone 8). The database is
 * the actual authority (CHECK constraints, the historical-lock triggers, and
 * the schedule/duplicate/set-items RPCs all re-validate independently) — this
 * is the trust-boundary validation for client input, per docs/SECURITY.md
 * sec 11.
 */

const uuid = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/, "expected a uuid");

// Mirrors `tierlists_slug_format` exactly.
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers, and single hyphens only");

const title = z.string().trim().min(1).max(200);
const prompt = z.string().trim().max(1000).nullable().optional();

export const createTierlistSchema = z.strictObject({
  slug,
  title,
  prompt,
});

export const updateTierlistSchema = z.strictObject({
  id: uuid,
  slug,
  title,
  prompt,
});

export const deleteTierlistSchema = z.strictObject({ id: uuid });

export const scheduleTierlistSchema = z.strictObject({
  id: uuid,
  // YYYY-MM-DD, matched to a plain SQL `date` — no timezone math here, the
  // canonical-timezone comparison happens server-side in schedule_tierlist().
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
});

export const unscheduleTierlistSchema = z.strictObject({ id: uuid });

export const duplicateTierlistSchema = z.strictObject({
  id: uuid,
  newSlug: slug,
});

// Mirrors `tierlist_items_label_len` (1-120); image_url is optional and must
// be https (M8 Decision 4 — no Storage upload, a pasted URL only).
const itemInput = z.strictObject({
  label: z.string().trim().min(1).max(120),
  imageUrl: z
    .string()
    .trim()
    .url()
    .refine((v) => v.startsWith("https://"), "image URL must be https")
    .nullable()
    .optional(),
  sortOrder: z.number().int().nonnegative(),
});

export const setTierlistItemsSchema = z.strictObject({
  id: uuid,
  items: z.array(itemInput).min(1).max(50),
});
