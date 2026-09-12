"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Edit the current user's own username/display name (Milestone 6). A plain
 * RLS-gated `UPDATE` on the caller's own `profiles` row — no RPC needed, the
 * existing `profiles_update_self` policy (`id = auth.uid()`) already
 * restricts this to the caller's own row; the explicit `.eq("id", ...)`
 * below is defense in depth, not the actual authorization boundary.
 *
 * Validation mirrors the database's own authority exactly:
 * `profiles_username_format` (`^[a-z0-9_]{3,20}$`) and
 * `profiles_display_name_len` (1-50 chars). Username is lowercased before
 * validation — the constraint requires lowercase, and the unique index is on
 * `lower(username)` regardless, so this is the canonical form either way.
 */

const inputSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3-20 lowercase letters, numbers, or underscores"),
  displayName: z.string().trim().min(1).max(50),
});

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "taken" | "unauthenticated" | "network" };

export async function updateProfile(input: unknown): Promise<UpdateProfileResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, reason: "unauthenticated" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: parsed.data.username,
        display_name: parsed.data.displayName,
      })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") {
        return { ok: false, reason: "taken" };
      }
      console.error(`[update-profile] update failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }

    // /profile reads this row via a Server Component; without this, a
    // successful save wouldn't be visible on this page until some unrelated
    // navigation happened to re-fetch it.
    revalidatePath("/profile");

    return { ok: true };
  } catch (err) {
    console.error("[update-profile] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
