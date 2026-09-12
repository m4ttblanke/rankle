"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapSendFriendRequest } from "@/lib/game/friends-schema";

/**
 * Send a friend request (Milestone 7). Identity comes only from the caller's
 * own authenticated session (`auth.getUser()`), never the request body —
 * same discipline as `submitRanking`/`createShare`. `recipientId` is
 * untrusted client input (learned from a `search_profiles` result), shape-
 * validated here and independently re-verified by `send_friend_request`
 * itself, which raises for a self-request or a nonexistent recipient and
 * otherwise does its own race-safe pending/friendship resolution
 * (`supabase/migrations/20260912200000_friends.sql`).
 */

const inputSchema = z.strictObject({
  recipientId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
      "expected a uuid",
    ),
});

export type SendFriendRequestResult =
  | { ok: true; status: "pending" | "friends" | "already_pending" }
  | { ok: false; reason: "invalid" | "self" | "not_found" | "unauthenticated" | "network" };

export async function sendFriendRequest(input: unknown): Promise<SendFriendRequestResult> {
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

    const { data, error } = await supabase.rpc("send_friend_request", {
      p_recipient_id: parsed.data.recipientId,
    });

    if (error) {
      const reason = mapRpcError(error.code);
      console.error(
        `[send-friend-request] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`,
      );
      return { ok: false, reason };
    }

    revalidatePath("/friends");
    return { ok: true, status: mapSendFriendRequest(data) };
  } catch (err) {
    console.error("[send-friend-request] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

function mapRpcError(code: string | undefined): "self" | "not_found" | "network" {
  switch (code) {
    case "23514": // check_violation -- self-request
      return "self";
    case "P0002": // no_data_found -- recipient profile does not exist
      return "not_found";
    default:
      return "network";
  }
}
