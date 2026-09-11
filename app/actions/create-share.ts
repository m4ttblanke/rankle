"use server";

import { z } from "zod";
import { getGuestId } from "@/lib/game/guest";
import { createClient } from "@/lib/supabase/server";

/**
 * Mint (or re-return) a share token for one of the caller's own official
 * submissions (Milestone 5).
 *
 * - `submissionId` arrives from the client (via `/results`, which learned it
 *   from its own eligibility-gated `get_results` call — see
 *   `results-schema.ts`). It is treated as untrusted input: shape-validated
 *   here, then independently re-verified by `create_share` itself, which
 *   raises `insufficient_privilege` unless this identity actually owns that
 *   submission (`supabase/migrations/20260909003915_sharing.sql`). The
 *   submission id is never used as an authorization mechanism on its own.
 * - Identity comes only from the signed httpOnly guest cookie — never from
 *   the request body — same discipline as `submitRanking`
 *   (`app/actions/submit-ranking.ts`). This action only *reads* the cookie
 *   (`getGuestId`, not `ensureGuestId`): a caller with no guest identity yet
 *   cannot own a submission, so there is nothing to mint.
 * - `create_share` is idempotent (one share per submission), so repeated
 *   calls for the same submission return the same token rather than
 *   proliferating rows.
 * - Runs under the RLS client (publishable key) — never the service role.
 */

const inputSchema = z.strictObject({
  submissionId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type CreateShareResult =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid" | "forbidden" | "network" };

export async function createShare(input: unknown): Promise<CreateShareResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const guestId = await getGuestId();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_share", {
      p_submission_id: parsed.data.submissionId,
      p_guest_id: guestId ?? undefined,
    });

    if (error) {
      const reason = mapRpcError(error.code);
      // Server-side only: code + reason. Never the submission id or guest id
      // (docs/SECURITY.md sec 21, sec 23).
      console.error(
        `[create-share] rpc rejected (reason=${reason}) code=${error.code ?? "?"} msg=${error.message}`,
      );
      return { ok: false, reason };
    }

    return { ok: true, token: data };
  } catch (err) {
    console.error("[create-share] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

/** Map a Postgres SQLSTATE raised by `create_share` to a UI-facing reason. */
function mapRpcError(code: string | undefined): "invalid" | "forbidden" | "network" {
  switch (code) {
    case "P0002": // no_data_found — submission id does not exist
      return "invalid";
    case "42501": // insufficient_privilege — not this identity's submission
      return "forbidden";
    default:
      return "network";
  }
}
