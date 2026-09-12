import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";

/**
 * Real auth-user integration path for Milestone 7 friends, against a REAL
 * local Supabase stack — mirrors
 * `lib/game/claim-guest-submissions.integration.test.ts`'s approach: two
 * genuine authenticated sessions (created via the service-role admin API,
 * signed in via `generateLink` + `verifyOtp`, no email actually sent), every
 * call after that using each session's own RLS-respecting client exactly as
 * the real app would.
 *
 * Skips entirely when `.env.test` is absent or `SUPABASE_SERVICE_ROLE_KEY`
 * is unset (e.g. CI without Docker).
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !anonKey || !serviceKey)(
  "friends, real auth users (local Supabase)",
  () => {
    if (url) assertLoopbackUrl(url);

    const admin = createClient<Database>(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    async function liveGame() {
      const { data, error } = await admin
        .from("tierlists")
        .select("id, tier_config, tierlist_items(id, sort_order)")
        .eq("status", "live")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No local live game — run `npx supabase db reset`.");
      return data;
    }

    async function signInAsFreshUser(usernamePrefix: string) {
      const email = `test-${randomUUID()}@rankle.test`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createErr || !created.user) throw createErr ?? new Error("createUser failed");

      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linkErr || !link) throw linkErr ?? new Error("generateLink failed");

      const sessionClient = createClient<Database>(url!, anonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: verified, error: verifyErr } = await sessionClient.auth.verifyOtp({
        type: "email",
        token_hash: link.properties.hashed_token,
      });
      if (verifyErr || !verified.session) throw verifyErr ?? new Error("verifyOtp failed");

      // Friendly, unique, prefix-matchable username so search_profiles tests
      // below don't depend on the auto-generated `user_<hex>` form.
      const username = `${usernamePrefix}${randomUUID().slice(0, 8)}`;
      const { error: renameErr } = await admin
        .from("profiles")
        .update({ username })
        .eq("id", created.user.id);
      if (renameErr) throw renameErr;

      return { userId: created.user.id, username, client: sessionClient };
    }

    async function submit(client: ReturnType<typeof createClient<Database>>, tierlistId: string, itemIds: string[], tier: string) {
      const { error } = await client.rpc("submit_ranking", {
        p_tierlist_id: tierlistId,
        p_items: itemIds.map((item_id, i) => ({ item_id, tier, position: i })),
      });
      if (error) throw error;
    }

    it("search_profiles finds the other user by prefix, authenticated only", async () => {
      const a = await signInAsFreshUser("searchtesta");
      const b = await signInAsFreshUser("searchtestb");

      const anon = createClient<Database>(url!, anonKey!);
      const { error: anonErr } = await anon.rpc("search_profiles", { p_query: b.username });
      expect(anonErr?.code).toBe("42501");

      const { data, error } = await a.client.rpc("search_profiles", {
        p_query: b.username.slice(0, 6),
      });
      expect(error).toBeNull();
      const results = (data as { results: { username: string }[] }).results;
      expect(results.some((r) => r.username === b.username)).toBe(true);
    });

    it("full request lifecycle: send, accept, symmetric friendship, then remove", async () => {
      const a = await signInAsFreshUser("lifecyclea");
      const b = await signInAsFreshUser("lifecycleb");

      const { data: sendResult, error: sendErr } = await a.client.rpc("send_friend_request", {
        p_recipient_id: b.userId,
      });
      expect(sendErr).toBeNull();
      expect((sendResult as { status: string }).status).toBe("pending");

      const { data: incoming } = await b.client.rpc("list_friend_requests");
      const incomingList = (incoming as { incoming: { request_id: string }[] }).incoming;
      expect(incomingList).toHaveLength(1);
      const requestId = incomingList[0].request_id;

      const { data: accepted, error: acceptErr } = await b.client.rpc("accept_friend_request", {
        p_request_id: requestId,
      });
      expect(acceptErr).toBeNull();
      expect(accepted).toBe(true);

      // symmetric: both sides see the friendship directly via RLS
      const { data: friendshipsForA } = await a.client
        .from("friendships")
        .select("user_id_low, user_id_high")
        .or(`user_id_low.eq.${a.userId},user_id_high.eq.${a.userId}`);
      expect(friendshipsForA).toHaveLength(1);
      const { data: friendshipsForB } = await b.client
        .from("friendships")
        .select("user_id_low, user_id_high")
        .or(`user_id_low.eq.${b.userId},user_id_high.eq.${b.userId}`);
      expect(friendshipsForB).toHaveLength(1);

      // now that they're friends, each can read the other's profile directly
      const { data: bsProfileViaA } = await a.client
        .from("profiles")
        .select("id")
        .eq("id", b.userId)
        .maybeSingle();
      expect(bsProfileViaA?.id).toBe(b.userId);

      // either side can remove; it disappears for both immediately
      const { data: removed, error: removeErr } = await b.client.rpc("remove_friend", {
        p_user_id: a.userId,
      });
      expect(removeErr).toBeNull();
      expect(removed).toBe(true);

      const { data: friendshipsAfter } = await a.client
        .from("friendships")
        .select("user_id_low, user_id_high")
        .or(`user_id_low.eq.${a.userId},user_id_high.eq.${a.userId}`);
      expect(friendshipsAfter).toHaveLength(0);

      // and A can no longer read B's profile directly (no relationship left)
      const { data: bsProfileAfter } = await a.client
        .from("profiles")
        .select("id")
        .eq("id", b.userId)
        .maybeSingle();
      expect(bsProfileAfter).toBeNull();
    });

    it("played status and friend results respect the full access rule end to end", async () => {
      const game = await liveGame();
      const itemIds = game.tierlist_items.map((i) => i.id);

      const a = await signInAsFreshUser("resultsa");
      const b = await signInAsFreshUser("resultsb");
      const c = await signInAsFreshUser("resultsc"); // never becomes a friend

      // become friends
      await a.client.rpc("send_friend_request", { p_recipient_id: b.userId });
      const { data: incoming } = await b.client.rpc("list_friend_requests");
      const requestId = (incoming as { incoming: { request_id: string }[] }).incoming[0].request_id;
      await b.client.rpc("accept_friend_request", { p_request_id: requestId });

      // before either submits: played status is false for both, no ranking
      // data anywhere in the payload
      const { data: beforeStatus } = await a.client.rpc("get_friend_played_status", {
        p_tierlist_id: game.id,
      });
      expect(JSON.stringify(beforeStatus)).not.toMatch(/tier|position/);
      expect(
        (beforeStatus as { friends: { user_id: string; played: boolean }[] }).friends.find(
          (f) => f.user_id === b.userId,
        )?.played,
      ).toBe(false);

      // caller (a) has not submitted yet -> get_friend_results is refused
      const { error: preSubmitErr } = await a.client.rpc("get_friend_results", {
        p_tierlist_id: game.id,
      });
      expect(preSubmitErr?.code).toBe("42501");

      // both a and b submit; c also submits but is never a's friend
      await submit(a.client, game.id, itemIds, "S");
      await submit(b.client, game.id, itemIds, "A");
      await submit(c.client, game.id, itemIds, "F");

      const { data: afterStatus } = await a.client.rpc("get_friend_played_status", {
        p_tierlist_id: game.id,
      });
      expect(
        (afterStatus as { friends: { user_id: string; played: boolean }[] }).friends.find(
          (f) => f.user_id === b.userId,
        )?.played,
      ).toBe(true);

      const { data: friendResults, error: resultsErr } = await a.client.rpc(
        "get_friend_results",
        { p_tierlist_id: game.id },
      );
      expect(resultsErr).toBeNull();
      const friends = (friendResults as { friends: { user: { id: string }; ranking: unknown[] }[] })
        .friends;
      expect(friends).toHaveLength(1); // only b -- c submitted but isn't a friend
      expect(friends[0].user.id).toBe(b.userId);
      expect(friends[0].ranking).toHaveLength(itemIds.length);
    });
  },
);
