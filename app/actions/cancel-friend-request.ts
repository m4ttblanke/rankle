"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Retract an unresolved outgoing friend request (Milestone 7) — sender-only,
 * distinct from decline (recipient-only). `cancel_friend_request` deletes
 * the row; it never touches `friendships`, so canceling a request that was
 * already accepted (and is therefore already gone) is a safe idempotent
 * no-op that cannot delete an existing friendship.
 */

const inputSchema = z.strictObject({
  requestId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type CancelFriendRequestResult =
  | { ok: true; canceled: boolean }
  | { ok: false; reason: "invalid" | "forbidden" | "unauthenticated" | "network" };

export async function cancelFriendRequest(input: unknown): Promise<CancelFriendRequestResult> {
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

    const { data, error } = await supabase.rpc("cancel_friend_request", {
      p_request_id: parsed.data.requestId,
    });

    if (error) {
      const reason = error.code === "42501" ? "forbidden" : "network";
      console.error(
        `[cancel-friend-request] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`,
      );
      return { ok: false, reason };
    }

    revalidatePath("/friends");
    return { ok: true, canceled: data === true };
  } catch (err) {
    console.error("[cancel-friend-request] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
