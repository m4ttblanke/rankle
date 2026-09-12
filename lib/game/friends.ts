import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  type FriendPlayedStatus,
  type FriendRequestsList,
  type ProfileSummary,
  type SearchResult,
  mapFriendPlayedStatus,
  mapListFriendRequests,
  mapSearchProfiles,
} from "./friends-schema";

/**
 * Friend-graph readers (Milestone 7) — account-only, mirroring the
 * `null`/`[]`-on-any-failure discipline of `get-results.ts` / `get-share.ts`
 * / `history.ts`. None of these are a trust boundary on their own: every
 * mutating action still re-derives identity server-side via `auth.uid()`
 * inside the RPCs (`supabase/migrations/20260912200000_friends.sql`); these
 * are read-only conveniences for signed-in pages.
 */

export type Friend = ProfileSummary;

/**
 * The current user's accepted friends. A plain RLS-gated read of `friendships`
 * (participant-only policy) followed by a `profiles` lookup for the other
 * side of each pair — the tightened M7 `profiles_select_self_or_friend`
 * policy allows this directly, no RPC needed, same "prefer existing safe
 * access" pattern as `getMyHistory()`.
 */
export async function listFriends(): Promise<Friend[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id_low, user_id_high")
      .or(`user_id_low.eq.${user.id},user_id_high.eq.${user.id}`);
    if (error) throw error;

    const friendIds = (rows ?? []).map((r) =>
      r.user_id_low === user.id ? r.user_id_high : r.user_id_low,
    );
    if (friendIds.length === 0) return [];

    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", friendIds);
    if (profilesErr) throw profilesErr;

    return (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
    }));
  } catch (err) {
    console.error("[friends] listFriends failed", err);
    return [];
  }
}

/**
 * Discover other users by username prefix. The `search_profiles` RPC does
 * every real authorization/normalization/cap decision itself
 * (authenticated-only, prefix match, capped at 20, excludes the caller) —
 * this reader only shapes the response and swallows failures to `[]`.
 */
export async function searchProfiles(query: string): Promise<SearchResult[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_profiles", { p_query: query });
    if (error) {
      console.error(`[friends] search_profiles rpc failed code=${error.code ?? "?"}`);
      return [];
    }
    return mapSearchProfiles(data);
  } catch (err) {
    console.error("[friends] search_profiles unexpected failure", err);
    return [];
  }
}

/** Incoming + outgoing pending requests, with the counterpart's safe profile
 *  fields — the ONE reader of that relationship (see the migration's header
 *  comment for why this isn't exposed via widened `profiles` RLS instead). */
export async function listFriendRequests(): Promise<FriendRequestsList> {
  const user = await getCurrentUser();
  if (!user) return { incoming: [], outgoing: [] };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_friend_requests");
    if (error) {
      console.error(`[friends] list_friend_requests rpc failed code=${error.code ?? "?"}`);
      return { incoming: [], outgoing: [] };
    }
    return mapListFriendRequests(data);
  } catch (err) {
    console.error("[friends] list_friend_requests unexpected failure", err);
    return { incoming: [], outgoing: [] };
  }
}

/**
 * Boolean-only "has this friend submitted today's/this game's ranking" —
 * safe to call BEFORE the caller's own submission (docs/MANUAL.md sec 17).
 * Never returns ranking data; used both for `/friends`' per-row status and
 * the pre-submission "N friends played today" line on `/`.
 */
export async function getFriendPlayedStatus(tierlistId: string): Promise<FriendPlayedStatus[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_friend_played_status", {
      p_tierlist_id: tierlistId,
    });
    if (error) {
      console.error(`[friends] get_friend_played_status rpc failed code=${error.code ?? "?"}`);
      return [];
    }
    return mapFriendPlayedStatus(data);
  } catch (err) {
    console.error("[friends] get_friend_played_status unexpected failure", err);
    return [];
  }
}
