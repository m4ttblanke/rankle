"use server";

import { clampDurationMs } from "@/lib/analytics/events";
import { logAnalyticsEvent } from "@/lib/analytics/log";
import { ensureGuestId } from "@/lib/game/guest";
import { isShareForTierlist } from "@/lib/game/get-share";
import {
  submitRankingInputSchema,
  type SubmitRankingResult,
} from "@/lib/game/submission";
import { createClient } from "@/lib/supabase/server";

/**
 * The one server-controlled submission boundary (Milestone 3; identity
 * resolution updated in Milestone 6).
 *
 * - Identity comes only from server-verified state — never from the request
 *   body. An authenticated caller (`auth.getUser()`, JWT-verified) submits as
 *   themselves; `submit_ranking` requires EXACTLY ONE of an authenticated
 *   user or a guest id, so a signed-in caller must never also send a guest
 *   id here (a leftover guest cookie is simply ignored, not minted further —
 *   `ensureGuestId()` is only called in the guest branch). A signed-out
 *   caller falls back to the signed httpOnly guest cookie, as before.
 * - The body is shape-validated; the database RPC `submit_ranking` remains the
 *   authoritative, atomic write path and the final authority on every semantic
 *   rule (open game, complete ranking, valid tiers/positions, one-per-identity
 *   — including a claimed guest submission counting as this user's own, see
 *   `supabase/migrations/20260912000000_guest_account_claiming.sql` —
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
  const { tierlistId, items, shareToken, clientDurationMs } = parsed.data;

  const supabase = await createClient();

  let guestId: string | null = null;
  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    } else {
      guestId = await ensureGuestId();
    }
  } catch (err) {
    console.error("[submit-ranking] could not establish identity", err);
    return { ok: false, reason: "network" };
  }

  try {
    const { error } = await supabase.rpc("submit_ranking", {
      p_tierlist_id: tierlistId,
      p_items: items,
      p_guest_id: guestId ?? undefined,
    });

    if (!error) {
      await logSubmissionEvents({
        tierlistId,
        userId,
        guestId,
        shareToken,
        clientDurationMs,
      });
      return { ok: true };
    }

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

/**
 * Log `ranking_submitted` (always, on a fresh success — never on the
 * `"already"` duplicate branch, which the caller never reaches this
 * function for) and, when a validated share continuation is present,
 * `share_recipient_submitted` (Product Analytics milestone, docs/TODO.md).
 *
 * `shareToken` is only ever an analytics attribution input here — it never
 * affects what gets submitted (that already happened, above). It is
 * re-validated exactly once, via `isShareForTierlist`, against this exact
 * `tierlistId` — and that single result drives BOTH `share_recipient_submitted`
 * and `ranking_submitted`'s own `entry_source` property. `submitRanking` is a
 * Server Action, callable directly with arbitrary well-shaped input, not only
 * through the UI (the same threat model `items`/`tierlistId` are already
 * validated against) — an unvalidated `shareToken` string alone must never be
 * enough to mark a submission `entry_source: "share"`; that would mislabel
 * the funnel without a matching `share_recipient_submitted`, the same kind of
 * forgery the attribution event itself already guards against. Never throws:
 * analytics must not be able to turn a successful submission into a failed
 * one.
 */
async function logSubmissionEvents(args: {
  tierlistId: string;
  userId: string | null;
  guestId: string | null;
  shareToken: string | undefined;
  clientDurationMs: number | undefined;
}): Promise<void> {
  try {
    const { tierlistId, userId, guestId, shareToken, clientDurationMs } = args;
    const durationMs = clampDurationMs(clientDurationMs);
    const validShare = Boolean(
      shareToken && (await isShareForTierlist(shareToken, tierlistId)),
    );

    await logAnalyticsEvent({
      eventName: "ranking_submitted",
      tierlistId,
      userId,
      guestId,
      properties: {
        authenticated: userId !== null,
        entry_source: validShare ? "share" : "direct",
        ...(durationMs !== null ? { duration_ms: durationMs } : {}),
      },
    });

    if (validShare) {
      await logAnalyticsEvent({
        eventName: "share_recipient_submitted",
        tierlistId,
        userId,
        guestId,
        shareToken,
      });
    }
  } catch (err) {
    console.error("[submit-ranking] analytics logging failed", err);
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
