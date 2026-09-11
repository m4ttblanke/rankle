import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Server-only by construction: importing `next/headers` (and `node:crypto`)
// makes Next fail the build if this module is ever pulled into a Client
// Component bundle. No `server-only` shim dependency is needed for that.

/**
 * Guest identity for anonymous play (Milestone 3).
 *
 * A guest is a random v4 UUID kept in a signed, httpOnly cookie:
 *
 *   rankle_guest = "<uuid>.<base64url(HMAC-SHA256(uuid, GUEST_COOKIE_SECRET))>"
 *
 * - httpOnly: browser JavaScript can neither read nor forge it. The value is
 *   never sent to the client, never logged, never put in an RSC payload.
 * - The HMAC lets the server reject a tampered value cleanly; a value that does
 *   not verify is treated as "no cookie".
 * - Identity is therefore established only from trusted server state. A
 *   `guest_id` supplied by browser code is never accepted (see the submit
 *   Server Action — it reads the cookie and ignores any client-provided id).
 *
 * This is deliberately an anti-repeat convenience, not strong identity proof
 * (docs/SECURITY.md sec 26). `submit_ranking` still enforces one submission per
 * guest per game with a unique index regardless of this cookie.
 *
 * Auth-ready: when Supabase Auth lands, callers use `auth.uid()` when signed in
 * and fall back to this guest id otherwise; `submit_ranking` already accepts
 * either identity.
 */

const COOKIE_NAME = "rankle_guest";
// Chrome clamps persistent cookies to 400 days; match that.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const value = process.env.GUEST_COOKIE_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "GUEST_COOKIE_SECRET is missing or too short (min 16 chars). " +
        "Set a server-only value — see docs/DEPLOY.md.",
    );
  }
  return value;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Serialize `id` into the signed cookie value. */
export function serializeGuestCookie(id: string): string {
  return `${id}.${sign(id)}`;
}

/** Parse + verify a signed cookie value. Returns the uuid, or null if the value
 *  is missing, malformed, or fails the signature / uuid check. */
export function parseGuestCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  if (!UUID_RE.test(id) || providedSig.length === 0) return null;
  if (!signaturesMatch(providedSig, sign(id))) return null;
  return id;
}

/** The cookie attributes used for every write of the guest cookie. */
export function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/**
 * Read the guest id from the request cookie. Returns null when there is no
 * valid guest cookie (a fresh visitor, or a tampered value). Safe to call from
 * a Server Component — it only reads.
 */
export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  return parseGuestCookie(store.get(COOKIE_NAME)?.value);
}

/**
 * Read the guest id, or mint one and set the signed cookie. Must be called from
 * a Server Action or Route Handler (it writes a cookie). Returns the id to pass
 * to `submit_ranking`.
 */
export async function ensureGuestId(): Promise<string> {
  const store = await cookies();
  const existing = parseGuestCookie(store.get(COOKIE_NAME)?.value);
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, serializeGuestCookie(id), guestCookieOptions());
  return id;
}

export const GUEST_COOKIE_NAME = COOKIE_NAME;
