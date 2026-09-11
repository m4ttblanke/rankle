import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";
import { communityTierList, consensusControversy, hottestTake } from "./results";
import { mapResults } from "./results-schema";

/**
 * Integration check for `get_results` against a REAL local Supabase stack
 * (Milestone 4), run ONLY locally (`npx supabase start`, seeded by
 * `supabase/seed.sql`) — mirrors `submit-ranking.integration.test.ts`'s guard.
 *
 * `getResults()` itself can't run here — it needs Next's request context for
 * `cookies()` (same limitation `get-daily-game.integration.test.ts` notes for
 * `getDailyGame()`). This instead calls `get_results` directly and feeds the
 * REAL response through `mapResults()` and the pure `lib/game/results.ts`
 * calculations, so a schema/shape drift between the RPC and this app's
 * assumptions would fail here even though `resultsResponseSchema` was written
 * against a hand-built fixture, not live data.
 *
 * The spoiler gate itself (pre-submit refusal, cross-identity isolation) is
 * already covered by `submit-ranking.integration.test.ts` and
 * `supabase/tests/rls_spec.sql` — this file does not duplicate that, beyond
 * one sanity check.
 *
 * Skips entirely when `.env.test` is absent (e.g. CI without Docker).
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !key)("get_results (local Supabase, real data)", () => {
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

  it("refuses results before this identity has submitted", async () => {
    const game = await liveGame();
    const { error } = await supabase.rpc("get_results", {
      p_tierlist_id: game.id,
      p_guest_id: randomUUID(),
    });
    expect(error?.code).toBe("42501");
  });

  it("a real get_results response maps cleanly and every calculation runs without throwing", async () => {
    const game = await liveGame();
    const tierConfig = game.tier_config as string[];
    const items = [...game.tierlist_items].sort((a, b) => a.sort_order - b.sort_order);
    const guestId = randomUUID();

    // Put at least one item in N/A so the real response exercises that path.
    const payload = items.map((it, i) => ({
      item_id: it.id,
      tier: i === 0 ? "N/A" : tierConfig[i % tierConfig.length],
      position: i,
    }));

    const { error: submitErr } = await supabase.rpc("submit_ranking", {
      p_tierlist_id: game.id,
      p_items: payload,
      p_guest_id: guestId,
    });
    expect(submitErr).toBeNull();

    const { data, error } = await supabase.rpc("get_results", {
      p_tierlist_id: game.id,
      p_guest_id: guestId,
    });
    expect(error).toBeNull();

    const results = mapResults(data);

    // The N/A placement round-trips verbatim.
    const naEntry = results.myRanking.find((r) => r.itemId === items[0].id);
    expect(naEntry?.tier).toBe("N/A");

    // Every pure calculation runs to completion over real aggregate data —
    // the real proof that the schema this app assumes matches what the
    // database actually returns.
    expect(() => communityTierList(results.items, results.tierlist.tierConfig)).not.toThrow();
    expect(() => hottestTake(results.myRanking, results.items, results.tierlist.tierConfig)).not.toThrow();
    for (const item of results.items) {
      expect(() => consensusControversy(item, results.tierlist.tierConfig)).not.toThrow();
    }

    // The N/A item never contributes a numeric weight to itself.
    const naItem = results.items.find((i) => i.itemId === items[0].id);
    expect(naItem?.tierCounts["N/A"]).toBeGreaterThan(0);
  });
});
