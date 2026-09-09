import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Uses the public publishable key (plus the caller's session cookie once auth
 * exists), so every query runs under Row Level Security. Do NOT swap this for a
 * service-role client to "make a query work" — that would bypass the release
 * gate and the spoiler gate (docs/SECURITY.md sec 5, sec 7).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore once session refresh happens in proxy/middleware.
            // (No authentication in Milestone 1.)
          }
        },
      },
    },
  );
}
