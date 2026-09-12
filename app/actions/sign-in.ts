"use server";

import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Send a magic-link sign-in email (Milestone 6). Supabase Auth, email OTP —
 * no passwords, no other providers.
 *
 * `emailRedirectTo` is always this app's own `/auth/callback`, built from
 * `NEXT_PUBLIC_APP_URL` — never a client-supplied value, so there is no way
 * for a caller to redirect a magic link anywhere else.
 */

const inputSchema = z.strictObject({
  email: z.email().max(254),
});

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "network" };

export async function signInWithMagicLink(input: unknown): Promise<SignInResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });
    if (error) {
      console.error(`[sign-in] signInWithOtp failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sign-in] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
