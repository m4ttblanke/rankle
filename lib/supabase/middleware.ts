import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Standard Supabase/Next.js SSR session-refresh pattern (Milestone 6) — keeps
 * the auth cookie valid across requests so Server Components never see a
 * stale/expired session. Touches only Supabase's own `sb-*` auth cookies;
 * completely separate from the `rankle_guest` cookie (`lib/game/guest.ts`),
 * which this never reads or writes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Triggers a token refresh when needed; the call's return value is unused
  // here on purpose — this middleware only keeps cookies fresh, it does not
  // gate any route (no page in this app requires auth to even render; e.g.
  // /profile does its own redirect-if-signed-out server-side).
  await supabase.auth.getUser();

  return response;
}
