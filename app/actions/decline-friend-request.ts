"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Decline an incoming friend request (Milestone 7) — recipient-only.
 * `decline_friend_request` deletes the row on resolution; no accepted/
 * declined history is retained (see the migration's header comment). Idempotent:
 * declining an already-resolved request returns `declined: false`, not an error.
 */

const inputSchema = z.strictObject({
  requestId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type DeclineFriendRequestResult =
  | { ok: true; declined: boolean }
  | { ok: false; reason: "invalid" | "forbidden" | "unauthenticated" | "network" };

export async function declineFriendRequest(input: unknown): Promise<DeclineFriendRequestResult> {
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

    const { data, error } = await supabase.rpc("decline_friend_request", {
      p_request_id: parsed.data.requestId,
    });

    if (error) {
      const reason = error.code === "42501" ? "forbidden" : "network";
      console.error(
        `[decline-friend-request] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`,
      );
      return { ok: false, reason };
    }

    revalidatePath("/friends");
    return { ok: true, declined: data === true };
  } catch (err) {
    console.error("[decline-friend-request] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
