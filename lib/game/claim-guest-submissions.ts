import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Claim every eligible guest submission for `guestId` on behalf of `userId`
 * (Milestone 6). Idempotent — safe to call on every sign-in.
 *
 * Both arguments must already be server-verified before this is called:
 * `userId` from `supabase.auth.getUser()` (JWT-verified), `guestId` from
 * `getGuestId()` (HMAC-verified signed cookie) — never from client input.
 * This is the ONLY call site for `claim_guest_submissions()`, which has no
 * grant to `anon`/`authenticated` and is reachable only via the service-role
 * client for exactly that reason (see `lib/supabase/service-role.ts`).
 *
 * Returns the number of NEWLY claimed submissions (0 if nothing was eligible,
 * including on a repeat call). Never throws — a failure here should not block
 * sign-in; it's simply retried on the next sign-in since the operation is
 * idempotent.
 */
export async function claimGuestSubmissions(
  userId: string,
  guestId: string,
): Promise<number> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("claim_guest_submissions", {
      p_user_id: userId,
      p_guest_id: guestId,
    });
    if (error) {
      console.error(
        `[claim-guest-submissions] rpc failed code=${error.code ?? "?"}`,
      );
      return 0;
    }
    return data ?? 0;
  } catch (err) {
    console.error("[claim-guest-submissions] unexpected failure", err);
    return 0;
  }
}
