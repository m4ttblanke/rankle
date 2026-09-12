import { z } from "zod";

/**
 * Validation + shaping for the Milestone 7 friend RPCs' JSON responses
 * (`search_profiles`, `list_friend_requests`, `get_friend_played_status`).
 * `get_friend_results` has its own module (`get-friend-results.ts`) mirroring
 * `results-schema.ts`'s shape instead, since it returns rankings, not profile
 * summaries.
 *
 * Every one of these RPCs is `SECURITY DEFINER` and enforces its own
 * authorization (auth.uid() required; see
 * `supabase/migrations/20260912200000_friends.sql`) — this module only
 * re-validates *shape*, same boundary discipline as the rest of `lib/game/*`.
 */

// Postgres `uuid` text form — duplicated per read-boundary module, matching
// the rest of `lib/game/*`.
const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    "expected a uuid",
  );

const profileSummarySchema = z.object({
  id: uuid,
  username: z.string().min(1),
  display_name: z.string().min(1),
  avatar_url: z.string().nullable(),
});

export type ProfileSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

function mapProfileSummary(raw: z.infer<typeof profileSummarySchema>): ProfileSummary {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.display_name,
    avatarUrl: raw.avatar_url,
  };
}

// ---------------------------------------------------------------------
// search_profiles
// ---------------------------------------------------------------------

export const relationshipSchema = z.enum([
  "none",
  "friends",
  "pending_outgoing",
  "pending_incoming",
]);

export type Relationship = z.infer<typeof relationshipSchema>;

const searchResultRowSchema = profileSummarySchema.extend({
  relationship: relationshipSchema,
});

const searchProfilesResponseSchema = z.object({
  results: z.array(searchResultRowSchema),
});

export type SearchResult = ProfileSummary & { relationship: Relationship };

export function mapSearchProfiles(raw: unknown): SearchResult[] {
  const parsed = searchProfilesResponseSchema.parse(raw);
  return parsed.results.map((r) => ({ ...mapProfileSummary(r), relationship: r.relationship }));
}

// ---------------------------------------------------------------------
// list_friend_requests
// ---------------------------------------------------------------------

const requestRowSchema = z.object({
  request_id: uuid,
  user: profileSummarySchema,
  created_at: z.string(),
});

const listFriendRequestsResponseSchema = z.object({
  incoming: z.array(requestRowSchema),
  outgoing: z.array(requestRowSchema),
});

export type FriendRequestEntry = {
  requestId: string;
  user: ProfileSummary;
  createdAt: string;
};

export type FriendRequestsList = {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
};

function mapRequestRow(raw: z.infer<typeof requestRowSchema>): FriendRequestEntry {
  return {
    requestId: raw.request_id,
    user: mapProfileSummary(raw.user),
    createdAt: raw.created_at,
  };
}

export function mapListFriendRequests(raw: unknown): FriendRequestsList {
  const parsed = listFriendRequestsResponseSchema.parse(raw);
  return {
    incoming: parsed.incoming.map(mapRequestRow),
    outgoing: parsed.outgoing.map(mapRequestRow),
  };
}

// ---------------------------------------------------------------------
// get_friend_played_status -- boolean only, no ranking data
// ---------------------------------------------------------------------

const playedStatusResponseSchema = z.object({
  friends: z.array(
    z.object({
      user_id: uuid,
      played: z.boolean(),
    }),
  ),
});

export type FriendPlayedStatus = { userId: string; played: boolean };

export function mapFriendPlayedStatus(raw: unknown): FriendPlayedStatus[] {
  const parsed = playedStatusResponseSchema.parse(raw);
  return parsed.friends.map((f) => ({ userId: f.user_id, played: f.played }));
}

// ---------------------------------------------------------------------
// send_friend_request -- the one RPC that returns a small status object
// rather than a list
// ---------------------------------------------------------------------

export const sendFriendRequestStatusSchema = z.enum(["pending", "friends", "already_pending"]);

const sendFriendRequestResponseSchema = z.object({
  status: sendFriendRequestStatusSchema,
});

export function mapSendFriendRequest(raw: unknown): z.infer<typeof sendFriendRequestStatusSchema> {
  return sendFriendRequestResponseSchema.parse(raw).status;
}
