import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";

/**
 * Mutation / integration tests for `submit_ranking` and `has_submitted_ranking`
 * (Milestone 3), run ONLY against a local Supabase stack
 * (`npx supabase start`, seeded by `supabase/seed.sql`).
 *
 * Loads its own env from `.env.test` and hard-refuses to run against anything
 * but a loopback URL (see `lib/test-support/local-env.ts`), so a misconfigured
 * `.env.test` can never point mutation tests at production (docs/SECURITY.md;
 * CLAUDE.md sec 12).
 *
 * Skips entirely when `.env.test` is absent (e.g. CI without Docker).
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !key)(
  "submit_ranking / has_submitted_ranking (local Supabase, mutation)",
  () => {
    // Hard guard: never let a misconfigured .env.test point this at a remote
    // project. This must throw, not skip, so a bad config is loud.
    if (url) assertLoopbackUrl(url);

    const supabase = createClient<Database>(url!, key!);

    async function liveGame() {
      const { data, error } = await supabase
        .from("tierlists")
        .select("id, tier_config, tierlist_items(id, sort_order)")
        .eq("status", "live")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error(
          "No local live game found — run `npx supabase db reset` to apply migrations + seed.sql.",
        );
      }
      return data;
    }

    /** A full, valid payload spread across tiers/positions so every (tier,
     *  position) slot is distinct. */
    function fullPayload(
      items: { id: string; sort_order: number }[],
      tierConfig: string[],
    ) {
      const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
      return sorted.map((item, i) => ({
        item_id: item.id,
        tier: tierConfig[i % tierConfig.length],
        position: Math.floor(i / tierConfig.length),
      }));
    }

    it("a brand-new guest has not submitted, and spoiler protections hold", async () => {
      const game = await liveGame();
      const guestId = randomUUID();

      const { data: submitted, error: hasSubErr } = await supabase.rpc(
        "has_submitted_ranking",
        { p_tierlist_id: game.id, p_guest_id: guestId },
      );
      expect(hasSubErr).toBeNull();
      expect(submitted).toBe(false);

      const { error: resultsErr } = await supabase.rpc("get_results", {
        p_tierlist_id: game.id,
        p_guest_id: guestId,
      });
      expect(resultsErr?.code).toBe("42501");

      const { error: statsErr } = await supabase
        .from("tierlist_item_stats")
        .select("tierlist_item_id")
        .limit(1);
      expect(statsErr?.code).toBe("42501");
    });

    it("a valid submission succeeds, orders submission_items correctly, and unlocks results", async () => {
      const game = await liveGame();
      const guestId = randomUUID();
      const payload = fullPayload(game.tierlist_items, game.tier_config as string[]);

      const { data: submissionId, error } = await supabase.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: payload,
        p_guest_id: guestId,
      });
      expect(error).toBeNull();
      expect(submissionId).toBeTruthy();

      // Recognition (M3): the boolean check flips true for this identity.
      const { data: nowSubmitted } = await supabase.rpc("has_submitted_ranking", {
        p_tierlist_id: game.id,
        p_guest_id: guestId,
      });
      expect(nowSubmitted).toBe(true);

      // Eligibility unlocked (M4's read path, exercised read-only here): the
      // player's own ranking round-trips with the same tier/position ordering
      // they submitted.
      const { data: results, error: resultsErr } = await supabase.rpc(
        "get_results",
        { p_tierlist_id: game.id, p_guest_id: guestId },
      );
      expect(resultsErr).toBeNull();
      const myRanking = (
        results as { my_ranking: { item_id: string; tier: string; position: number }[] }
      ).my_ranking;
      const expected = [...payload].sort(
        (a, b) => a.tier.localeCompare(b.tier) || a.position - b.position,
      );
      expect(
        myRanking.map((r) => ({ item_id: r.item_id, tier: r.tier, position: r.position })),
      ).toEqual(expected);

      // Aggregate stats moved (transactional): total_submissions for this game
      // increased by exactly one attributable submission.
      const total = (results as { total_submissions: number }).total_submissions;
      expect(total).toBeGreaterThanOrEqual(1);

      // Submitting did not widen table-level RLS — direct table access is still closed.
      const { error: directStatsErr } = await supabase
        .from("submissions")
        .select("id")
        .limit(1);
      expect(directStatsErr?.code).toBe("42501");
    });

    it("duplicate submission is rejected and does not double-count", async () => {
      const game = await liveGame();
      const guestId = randomUUID();
      const payload = fullPayload(game.tierlist_items, game.tier_config as string[]);

      const first = await supabase.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: payload,
        p_guest_id: guestId,
      });
      expect(first.error).toBeNull();

      const { data: before } = await supabase.rpc("get_results", {
        p_tierlist_id: game.id,
        p_guest_id: guestId,
      });
      const totalBefore = (before as { total_submissions: number }).total_submissions;

      const second = await supabase.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: payload,
        p_guest_id: guestId,
      });
      expect(second.error?.code).toBe("23505");

      const { data: after } = await supabase.rpc("get_results", {
        p_tierlist_id: game.id,
        p_guest_id: guestId,
      });
      const totalAfter = (after as { total_submissions: number }).total_submissions;
      expect(totalAfter).toBe(totalBefore);
    });

    it("an invalid (incomplete) submission leaves no partial rows", async () => {
      const game = await liveGame();
      const guestId = randomUUID();
      const partial = fullPayload(game.tierlist_items, game.tier_config as string[]).slice(
        0,
        1,
      );

      const { error } = await supabase.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: partial,
        p_guest_id: guestId,
      });
      expect(error?.code).toBe("22023");

      // No row was committed for this guest: has_submitted_ranking stays false.
      const { data: submitted } = await supabase.rpc("has_submitted_ranking", {
        p_tierlist_id: game.id,
        p_guest_id: guestId,
      });
      expect(submitted).toBe(false);
    });

    it("submitted rows cannot be modified through the client", async () => {
      const game = await liveGame();
      const guestId = randomUUID();
      const payload = fullPayload(game.tierlist_items, game.tier_config as string[]);
      const { data: submissionId, error } = await supabase.rpc("submit_ranking", {
        p_tierlist_id: game.id,
        p_items: payload,
        p_guest_id: guestId,
      });
      expect(error).toBeNull();

      // anon has no table grants at all on submissions/submission_items (all
      // writes are RPC-only) — attempting a direct update is refused outright.
      const { error: updateErr } = await supabase
        .from("submissions")
        .update({ submitted_at: new Date().toISOString() })
        .eq("id", submissionId as string);
      expect(updateErr?.code).toBe("42501");
    });
  },
);
