"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Remove a friend (Milestone 7) — either participant may do this; removal is
 * symmetric (one `friendships` row) and takes effect immediately for both
 * sides. No past submission data, aggregate, or share link is touched — only
 * future friend-specific comparisons disappear (docs/MANUAL.md sec 16-19).
 * Idempotent: removing an already-removed (or never-existing) friendship
 * returns `removed: false`, not an error.
 */

const inputSchema = z.strictObject({
  userId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type RemoveFriendResult =
  | { ok: true; removed: boolean }
  | { ok: false; reason: "invalid" | "unauthenticated" | "network" };

export async function removeFriend(input: unknown): Promise<RemoveFriendResult> {
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

    const { data, error } = await supabase.rpc("remove_friend", {
      p_user_id: parsed.data.userId,
    });

    if (error) {
      console.error(`[remove-friend] rpc failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }

    revalidatePath("/friends");
    revalidatePath("/results");
    return { ok: true, removed: data === true };
  } catch (err) {
    console.error("[remove-friend] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
