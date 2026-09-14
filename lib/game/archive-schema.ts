import { z } from "zod";

/**
 * Validation + shaping for the public archive read (Milestone 9) — same
 * read-boundary discipline as `schema.ts`/`history-schema.ts`.
 */
export const archiveRowSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  release_date: z.string(),
});

export type ArchiveEntry = {
  tierlistId: string;
  slug: string;
  title: string;
  releaseDate: string;
  isToday: boolean;
  /** `null` for a guest (no played/unplayed indicator is shown at all, by
   *  design -- see `getArchive()`); a plain boolean for a signed-in user. */
  played: boolean | null;
  /** Only set when `played` is `true` -- links straight to the existing
   *  `/history/[submissionId]` route. */
  submissionId: string | null;
};
