import { z } from "zod";

/**
 * Canonical product-analytics event vocabulary (Product Analytics milestone,
 * docs/TODO.md). Deliberately six events, not the full candidate list — see
 * the migration comment on `public.analytics_events` for what was dropped
 * and why (DB truth already answers it more accurately).
 */
export const ANALYTICS_EVENT_NAMES = [
  "daily_game_viewed",
  "ranking_started",
  "ranking_completed",
  "ranking_submitted",
  "share_opened",
  "share_recipient_submitted",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * The only two events a Client Component may ask the server to log, via
 * `app/actions/log-event.ts`. Every other event is server-authoritative —
 * logged directly by the Server Action/Component that already confirmed the
 * underlying fact (a successful submission, a resolved share) — and is never
 * reachable from this generic endpoint, so a client can't forge e.g. a fake
 * `ranking_submitted` or `share_recipient_submitted`.
 */
export const CLIENT_LOGGABLE_EVENT_NAMES = [
  "ranking_started",
  "ranking_completed",
] as const;

export type ClientLoggableEventName =
  (typeof CLIENT_LOGGABLE_EVENT_NAMES)[number];

/**
 * Cap for `ranking_submitted`'s client-timed `duration_ms` (start -> submit).
 * A tab left open for hours, or across a browser restart, should not distort
 * the median/p75 completion time — anything over this is treated as an
 * abandoned/stale session and excluded (`null`), not clamped to the cap.
 */
export const MAX_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

export const entrySourceSchema = z.enum(["direct", "share"]);
export type EntrySource = z.infer<typeof entrySourceSchema>;

/**
 * Shape a Client Component may send to `app/actions/log-event.ts`. No
 * ranking contents, no identifiers beyond the tierlist id — identity
 * (`user_id`/`guest_id`) is resolved server-side from trusted state, never
 * accepted from the client (same discipline as `submitRanking`/`createShare`).
 */
export const logEventInputSchema = z
  .object({
    eventName: z.enum(CLIENT_LOGGABLE_EVENT_NAMES),
    tierlistId: uuid,
    entrySource: entrySourceSchema,
    itemCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export type LogEventInput = z.infer<typeof logEventInputSchema>;

/** Clamp a client-reported duration to a plausible range, or `null` if it
 *  isn't one — never trusted blindly, but harmless if wrong (it only affects
 *  an analytics timing bucket, never gameplay/security). */
export function clampDurationMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_DURATION_MS) return null;
  return Math.round(value);
}
