"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Accept an incoming friend request (Milestone 7). `accept_friend_request`
 * derives the caller from `auth.uid()` and independently verifies they are
 * the request's recipient — the sender cannot accept their own outgoing
 * request, and an unrelated user cannot act on it at all
 * (`supabase/migrations/20260912200000_friends.sql`). Returns `accepted:
 * false` (not an error) if the request was already resolved by someone else
 * — idempotent, matching `submitRanking`'s "duplicate is not an error" style.
 */

const inputSchema = z.strictObject({
  requestId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type AcceptFriendRequestResult =
  | { ok: true; accepted: boolean }
  | { ok: false; reason: "invalid" | "forbidden" | "unauthenticated" | "network" };

export async function acceptFriendRequest(input: unknown): Promise<AcceptFriendRequestResult> {
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

    const { data, error } = await supabase.rpc("accept_friend_request", {
      p_request_id: parsed.data.requestId,
    });

    if (error) {
      const reason = error.code === "42501" ? "forbidden" : "network";
      console.error(
        `[accept-friend-request] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`,
      );
      return { ok: false, reason };
    }

    revalidatePath("/friends");
    return { ok: true, accepted: data === true };
  } catch (err) {
    console.error("[accept-friend-request] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
