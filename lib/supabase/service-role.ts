import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role Supabase client. Bypasses RLS and every table grant entirely.
 * Server-only by necessity: `SUPABASE_SERVICE_ROLE_KEY` is never a
 * `NEXT_PUBLIC_*` variable, so it is simply absent from any browser bundle
 * (docs/SECURITY.md sec 5).
 *
 * The ONE legitimate use in this codebase: `lib/game/claim-guest-submissions.ts`,
 * called only from `app/auth/callback`'s Route Handler, after that handler has
 * independently (a) confirmed a real Supabase Auth session via `auth.getUser()`
 * (JWT-verified) and (b) read+HMAC-verified the guest cookie via the existing
 * `getGuestId()`.
 *
 * `claim_guest_submissions()` is deliberately NOT granted EXECUTE to
 * `anon`/`authenticated` — its true authorization check ("does this caller
 * actually possess the signed httpOnly guest cookie?") depends on
 * `GUEST_COOKIE_SECRET`, which only Next.js holds; Postgres/RLS cannot express
 * that check on its own. This client is the only way to reach it. Do not
 * reach for this client for anything RLS can already express — see
 * docs/SECURITY.md sec 5, sec 26.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing or empty — required for guest-history " +
        "claiming on sign-in. Set a server-only value; see docs/DEPLOY.md.",
    );
  }
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
