import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch friend-specific ranking comparisons for a game (Milestone 7).
 *
 * The spoiler gate is enforced by the `get_friend_results` RPC itself
 * (`SECURITY DEFINER`; requires the caller to already have an official
 * submission for this game — docs/SECURITY.md sec 24,
 * `supabase/migrations/20260912200000_friends.sql`). This reader does not
 * duplicate that check; it treats "not eligible" the same as "any other
 * failure" and returns `null`, mirroring `get-results.ts` exactly so
 * `/results` can render its Friends section only when there is something to
 * show, without distinguishing failure modes to the caller.
 *
 * A `null` return means "render nothing for this section" — not eligible
 * (shouldn't happen: `/results` only reaches this after its own eligibility
 * gate), not signed in, or a transient failure. An empty `{ friends: [] }`
 * (mapped to `[]` here) is a normal, expected state — "no friends have
 * submitted yet" — not an error.
 */

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

const friendResultRowSchema = z.object({
  user: z.object({
    id: uuid,
    username: z.string().min(1),
    display_name: z.string().min(1),
    avatar_url: z.string().nullable(),
  }),
  ranking: z.array(
    z.object({
      item_id: uuid,
      tier: z.string().min(1).max(8),
      position: z.number().int().nonnegative(),
    }),
  ),
});

const friendResultsResponseSchema = z.object({
  friends: z.array(friendResultRowSchema),
});

export type FriendResultEntry = {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  ranking: { itemId: string; tier: string; position: number }[];
};

function mapFriendResults(raw: unknown): FriendResultEntry[] {
  const parsed = friendResultsResponseSchema.parse(raw);
  return parsed.friends.map((f) => ({
    user: {
      id: f.user.id,
      username: f.user.username,
      displayName: f.user.display_name,
      avatarUrl: f.user.avatar_url,
    },
    ranking: f.ranking.map((r) => ({ itemId: r.item_id, tier: r.tier, position: r.position })),
  }));
}

export async function getFriendResults(tierlistId: string): Promise<FriendResultEntry[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_friend_results", {
      p_tierlist_id: tierlistId,
    });

    if (error) {
      if (error.code !== "42501") {
        console.error(
          `[get-friend-results] rpc failed game=${tierlistId} code=${error.code ?? "?"}`,
        );
      }
      return null;
    }

    return mapFriendResults(data);
  } catch (err) {
    console.error("[get-friend-results] unexpected failure", err);
    return null;
  }
}
