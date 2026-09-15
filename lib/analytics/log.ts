import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/supabase/types";
import type { AnalyticsEventName } from "./events";

export type LogAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  tierlistId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  /**
   * A share token already validated by the caller (e.g. a re-confirmed
   * `?share=` continuation, or the token `SharePage` just resolved via
   * `getShare`). Resolved internally to `shares.id` before the insert — the
   * public, guessable token string itself is never persisted or otherwise
   * stored (docs/SECURITY.md sec 8, sec 23).
   */
  shareToken?: string | null;
  properties?: Record<string, Json>;
};

/**
 * Queue one product-analytics event row for a write AFTER the response has
 * already been sent (Product Analytics milestone, docs/TODO.md), via
 * Next's `after()` — so logging an event never adds latency to a page view,
 * a submission, or any other request it's called from. This is the ONE
 * place that ever touches `public.analytics_events` — every call site
 * (Server Actions, Server Components) goes through this function rather
 * than the table directly.
 *
 * - Never throws, never rejects, never blocks the caller — resolves as soon
 *   as the write is scheduled, not once it completes. Every failure mode of
 *   the write itself is swallowed (after a server-only log line) inside the
 *   `after()` callback, so it can't surface anywhere — analytics failure
 *   must not be able to break gameplay, submission, sharing, or auth.
 * - Writes only on a real Vercel Production deployment
 *   (`VERCEL_ENV === "production"`) — deliberately NOT `NODE_ENV`, which is
 *   `"production"` for every Vercel deployment (`next build` always produces
 *   a production build, so Preview deployments have `NODE_ENV === "production"`
 *   too). `VERCEL_ENV` is the value that actually distinguishes Production
 *   from Preview (Vercel's own system env var — unset locally and in every
 *   test run, so those stay a no-op the same way). Local dev, the test
 *   suite, and Preview deployments must never pollute production analytics
 *   (docs/DEPLOY.md).
 * - Uses the service-role client, the same trusted pattern as
 *   `claim_guest_submissions` (docs/SECURITY.md sec 26): the table has no
 *   grant to `anon`/`authenticated` at all, so this is the only way to write
 *   to it. Identity (`userId`/`guestId`) must already be resolved by the
 *   caller from trusted server state (`auth.getUser()` / `getGuestId()`) —
 *   this function does not read cookies or sessions itself.
 */
export async function logAnalyticsEvent(
  input: LogAnalyticsEventInput,
): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;

  try {
    after(() => writeAnalyticsEvent(input));
  } catch (err) {
    // `after()` itself throws if called outside a request scope — swallow
    // rather than let a mis-placed call site break its caller.
    console.error("[analytics] could not schedule event", err);
  }
}

async function writeAnalyticsEvent(
  input: LogAnalyticsEventInput,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    let shareId: string | null = null;
    if (input.shareToken) {
      const { data } = await supabase
        .from("shares")
        .select("id")
        .eq("token", input.shareToken)
        .maybeSingle();
      shareId = data?.id ?? null;
    }

    const { error } = await supabase.from("analytics_events").insert({
      event_name: input.eventName,
      tierlist_id: input.tierlistId ?? null,
      user_id: input.userId ?? null,
      guest_id: input.guestId ?? null,
      share_id: shareId,
      properties: input.properties ?? {},
    });

    if (error) {
      console.error(
        `[analytics] insert failed event=${input.eventName} code=${error.code ?? "?"}`,
      );
    }
  } catch (err) {
    console.error("[analytics] unexpected failure", err);
  }
}
