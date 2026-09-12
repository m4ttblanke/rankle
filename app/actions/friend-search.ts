"use server";

import { z } from "zod";
import { searchProfiles } from "@/lib/game/friends";
import type { SearchResult } from "@/lib/game/friends-schema";

/**
 * Search for another Rankle user by username prefix (Milestone 7), for the
 * `/friends` search box's type-ahead. `search_profiles` (SECURITY DEFINER)
 * does every real decision itself — authenticated-only, prefix match,
 * normalized/lowercased, capped at 20, excludes the caller
 * (`supabase/migrations/20260912200000_friends.sql`). This action only
 * shape-validates the query string; `searchProfiles()`
 * (`lib/game/friends.ts`) already swallows any RPC/auth failure to `[]`.
 */

const inputSchema = z.strictObject({
  query: z.string().max(50),
});

export type FriendSearchResult =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: "invalid" };

export async function friendSearch(input: unknown): Promise<FriendSearchResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const results = await searchProfiles(parsed.data.query);
  return { ok: true, results };
}
