"use server";

import { logAnalyticsEvent } from "@/lib/analytics/log";
import { logEventInputSchema } from "@/lib/analytics/events";
import { getGuestId } from "@/lib/game/guest";
import { createClient } from "@/lib/supabase/server";

/**
 * The one client-reachable analytics boundary (Product Analytics milestone,
 * docs/TODO.md). Restricted to `ranking_started`/`ranking_completed` only
 * (enforced by `logEventInputSchema`'s enum) — every other event is
 * server-authoritative and logged directly from the Server Action/Component
 * that already confirmed the underlying fact, never from here. A client
 * cannot forge a fake `ranking_submitted` or `share_recipient_submitted`
 * through this action.
 *
 * Identity comes only from trusted server state — `auth.getUser()` / a
 * read-only `getGuestId()` — never from the request body, same discipline as
 * `submitRanking`/`createShare`. `getGuestId()` (not `ensureGuestId()`): this
 * action must never mint a guest cookie merely because someone started
 * ranking — minting stays tied to an actual submission, unchanged product
 * behavior (docs/SECURITY.md sec 26).
 *
 * Never throws: analytics failure must not surface to the caller or break
 * the ranking board. Callers should fire this without awaiting a UI change
 * on its result.
 */
export async function logEvent(input: unknown): Promise<void> {
  const parsed = logEventInputSchema.safeParse(input);
  if (!parsed.success) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const guestId = user ? null : await getGuestId();

    await logAnalyticsEvent({
      eventName: parsed.data.eventName,
      tierlistId: parsed.data.tierlistId,
      userId: user?.id ?? null,
      guestId,
      properties: {
        authenticated: Boolean(user),
        entry_source: parsed.data.entrySource,
        ...(parsed.data.itemCount !== undefined
          ? { item_count: parsed.data.itemCount }
          : {}),
      },
    });
  } catch {
    // Never let an identity-resolution failure surface to the caller.
  }
}
