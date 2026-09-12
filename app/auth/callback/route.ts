import { NextResponse } from "next/server";
import { claimGuestSubmissions } from "@/lib/game/claim-guest-submissions";
import { getGuestId } from "@/lib/game/guest";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link exchange (Milestone 6). Fixed destinations only — `/profile` on
 * success, `/login` on failure — never a client-supplied redirect target, so
 * there is no open-redirect surface here at all.
 *
 * After a successful session exchange, claims this identity's eligible guest
 * history (`claimGuestSubmissions` — service-role, the only call site for
 * `claim_guest_submissions()`; see `lib/supabase/service-role.ts`). Both
 * inputs it uses are server-verified in this same request: the user id from
 * `auth.getUser()` (JWT-verified) and the guest id from `getGuestId()`
 * (HMAC-verified signed cookie) — never anything from the request itself. A
 * claim failure is logged and never blocks sign-in (idempotent; retried on
 * the next sign-in).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const guestId = await getGuestId();
          if (guestId) {
            await claimGuestSubmissions(user.id, guestId);
          }
          return NextResponse.redirect(new URL("/profile", request.url));
        }
      }
    } catch (err) {
      console.error("[auth-callback] unexpected failure", err);
    }
  }

  return NextResponse.redirect(new URL("/login?error=1", request.url));
}
