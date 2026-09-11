"use server";

import { ensureGuestId } from "@/lib/game/guest";
import {
  submitRankingInputSchema,
  type SubmitRankingResult,
} from "@/lib/game/submission";
import { createClient } from "@/lib/supabase/server";

/**
 * The one server-controlled submission boundary (Milestone 3).
 *
 * - Identity comes only from the signed httpOnly guest cookie — never from the
 *   request body.
 * - The body is shape-validated; the database RPC `submit_ranking` remains the
 *   authoritative, atomic write path and the final authority on every semantic
 *   rule (open game, complete ranking, valid tiers/positions, one-per-identity,
 *   transactional aggregates).
 * - Runs under the RLS client (publishable key). The service-role key is never
 *   used here.
 * - CSRF: this is a Next.js Server Action (same-origin POST with Origin/Host
 *   verification); `SameSite=Lax` on the guest cookie is defense in depth.
 * - Returns a narrow, non-leaky result. Success is reported only after the
 *   database confirms the write.
 */
export async function submitRanking(
  input: unknown,
): Promise<SubmitRankingResult> {
  const parsed = submitRankingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const { tierlistId, items } = parsed.data;

  let guestId: string;
  try {
    guestId = await ensureGuestId();
  } catch (err) {
    console.error("[submit-ranking] could not establish guest identity", err);
    return { ok: false, reason: "network" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_ranking", {
      p_tierlist_id: tierlistId,
      p_items: items,
      p_guest_id: guestId,
    });

    if (!error) return { ok: true };

    const reason = mapRpcError(error.code);
    // Server-side only: code + message + game id. Never the ranking payload or
    // the guest id (docs/SECURITY.md sec 21, sec 23).
    console.error(
      `[submit-ranking] rpc rejected (reason=${reason}) game=${tierlistId} code=${error.code ?? "?"} msg=${error.message}`,
    );
    return { ok: false, reason };
  } catch (err) {
    console.error("[submit-ranking] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

/** Map a Postgres SQLSTATE raised by `submit_ranking` to a UI-facing reason. */
function mapRpcError(
  code: string | undefined,
): "already" | "invalid" | "closed" | "network" {
  switch (code) {
    case "23505": // unique_violation — one submission per identity/game
      return "already";
    case "23001": // restrict_violation — game not open / has no items
      return "closed";
    case "22023": // invalid_parameter_value — payload/tier/position/count
    case "23514": // check_violation — identity guard
    case "P0002": // no_data_found — game id does not exist
      return "invalid";
    default:
      return "network";
  }
}
