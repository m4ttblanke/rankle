import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";

/**
 * Real auth-user integration path for guest -> account claiming (Milestone
 * 6), against a REAL local Supabase stack. Unlike the rest of `lib/game/*`'s
 * integration tests, this one exercises a genuine authenticated session end
 * to end — not just RPC calls under an anon key — because that's the only
 * way to prove `auth.users` -> `handle_new_user` -> `profiles`, RLS, and the
 * claim-aware RPCs all actually compose correctly for a real signed-in user,
 * not just in `supabase/tests/rls_spec.sql`'s simulated-role harness.
 *
 * A real user is created via the service-role admin API
 * (`auth.admin.createUser`), then signed in via `admin.generateLink` +
 * `verifyOtp` on a plain (anon-key) client — the standard way to obtain a
 * genuine session in tests without sending/receiving real email. From that
 * point on, every call below uses that authenticated client exactly as the
 * real app would (RLS-respecting, no service-role shortcuts) — the only
 * service-role use is the claim call itself, matching production
 * (`lib/supabase/service-role.ts`, `lib/game/claim-guest-submissions.ts`).
 *
 * Skips entirely when `.env.test` is absent (e.g. CI without Docker) or
 * `SUPABASE_SERVICE_ROLE_KEY` is unset.
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !anonKey || !serviceKey)(
  "guest -> account claiming, real auth user (local Supabase)",
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

    /** Create a real auth.users row and return a real, RLS-respecting
     *  session client for it — no email actually sent or received. */
    async function signInAsFreshUser() {
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

      return { userId: created.user.id, client: sessionClient };
    }

    it("auth.users -> handle_new_user creates a real profile row", async () => {
      const { userId } = await signInAsFreshUser();
      const { data, error } = await admin
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", userId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.username).toMatch(/^[a-z0-9_]{3,20}$/);
      expect(data?.display_name).toBeTruthy();
    });

    it(
      "full transition B: guest plays, signs in, claim is immediate, results/share/history all work, " +
        "and a second direct submission is blocked",
      async () => {
        const game = await liveGame();
        const itemIds = game.tierlist_items.map((i) => i.id);
        const guestId = randomUUID();

        // guest plays (anon key, no session)
        const anon = createClient<Database>(url!, anonKey!);
        const { error: guestSubmitErr } = await anon.rpc("submit_ranking", {
          p_tierlist_id: game.id,
          p_items: itemIds.map((item_id, i) => ({ item_id, tier: "S", position: i })),
          p_guest_id: guestId,
        });
        expect(guestSubmitErr).toBeNull();

        // sign in as a fresh real user
        const { userId, client } = await signInAsFreshUser();

        // pre-claim: this real authenticated session is NOT yet recognized
        const { data: before } = await client.rpc("has_submitted_ranking", {
          p_tierlist_id: game.id,
        });
        expect(before).toBe(false);

        // the claim itself -- service-role, exactly like
        // app/auth/callback -> claimGuestSubmissions
        const { data: claimedCount, error: claimErr } = await admin.rpc(
          "claim_guest_submissions",
          { p_user_id: userId, p_guest_id: guestId },
        );
        expect(claimErr).toBeNull();
        expect(claimedCount).toBe(1);

        // immediately recognized as already-submitted, via the real session
        const { data: after } = await client.rpc("has_submitted_ranking", {
          p_tierlist_id: game.id,
        });
        expect(after).toBe(true);

        // authenticated results work and show the claimed ranking
        const { data: results, error: resultsErr } = await client.rpc("get_results", {
          p_tierlist_id: game.id,
        });
        expect(resultsErr).toBeNull();
        const claimedSubmissionId = (results as { submission_id: string }).submission_id;
        expect(claimedSubmissionId).toBeTruthy();
        expect((results as { my_ranking: unknown[] }).my_ranking).toHaveLength(itemIds.length);

        // authenticated share creation/reuse works for the claimed submission
        const { data: token, error: shareErr } = await client.rpc("create_share", {
          p_submission_id: claimedSubmissionId,
        });
        expect(shareErr).toBeNull();
        expect(token).toMatch(/^[0-9a-f]{32}$/);

        // authenticated history: the real session can read the claimed row
        // directly via RLS (what /profile and /history/[id] actually do)
        const { data: historyRow, error: historyErr } = await client
          .from("submissions")
          .select("id")
          .eq("id", claimedSubmissionId)
          .maybeSingle();
        expect(historyErr).toBeNull();
        expect(historyRow?.id).toBe(claimedSubmissionId);

        // a second, direct submission for the same game is blocked
        const { error: dupErr } = await client.rpc("submit_ranking", {
          p_tierlist_id: game.id,
          p_items: itemIds.map((item_id, i) => ({ item_id, tier: "F", position: i })),
        });
        expect(dupErr?.code).toBe("23505");
      },
    );

    it("repeated claim calls for the same (user, guest) pair are idempotent", async () => {
      const game = await liveGame();
      const itemIds = game.tierlist_items.map((i) => i.id);
      const guestId = randomUUID();

      const anon = createClient<Database>(url!, anonKey!);
      await anon.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: itemIds.map((item_id, i) => ({ item_id, tier: "A", position: i })),
        p_guest_id: guestId,
      });

      const { userId } = await signInAsFreshUser();

      const first = await admin.rpc("claim_guest_submissions", {
        p_user_id: userId,
        p_guest_id: guestId,
      });
      expect(first.data).toBe(1);

      const second = await admin.rpc("claim_guest_submissions", {
        p_user_id: userId,
        p_guest_id: guestId,
      });
      expect(second.data).toBe(0);

      const { count } = await admin
        .from("claimed_guest_submissions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      expect(count).toBe(1);
    });
  },
);
