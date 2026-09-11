import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";
import { mapShare } from "./share-schema";

/**
 * Integration check for `create_share` / `get_share` against a REAL local
 * Supabase stack (Milestone 5), run ONLY locally (`npx supabase start`,
 * seeded by `supabase/seed.sql`) — mirrors `get-results.integration.test.ts`.
 *
 * `getShare()` / `getTierlistIdBySlug()` themselves can't run here (they need
 * Next's request context for `cookies()`) — this calls the RPCs directly and
 * feeds real responses through `mapShare()`, proving the app's assumed shape
 * matches what the database actually returns.
 *
 * The spoiler-gate SQL behavior itself (locked/unlocked eligibility,
 * ownership, revocation) is already exhaustively covered by
 * `supabase/tests/rls_spec.sql` — this file proves the app-layer wiring on
 * top of it, same division of responsibility as the results integration test.
 *
 * Skips entirely when `.env.test` is absent (e.g. CI without Docker).
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !key)("create_share / get_share (local Supabase, real data)", () => {
  if (url) assertLoopbackUrl(url);

  const supabase = createClient<Database>(url!, key!);

  async function liveGame() {
    const { data, error } = await supabase
      .from("tierlists")
      .select("id, slug, tier_config, tierlist_items(id, sort_order)")
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

  async function submitAsGuest(gameId: string, itemIds: string[], guestId: string) {
    const { error } = await supabase.rpc("submit_ranking", {
      p_tierlist_id: gameId,
      p_items: itemIds.map((item_id, i) => ({ item_id, tier: "S", position: i })),
      p_guest_id: guestId,
    });
    expect(error).toBeNull();
  }

  it("a real create_share -> get_share round trip maps cleanly through the app's shape", async () => {
    const game = await liveGame();
    const itemIds = game.tierlist_items.map((i) => i.id);
    const senderGuestId = randomUUID();
    const recipientGuestId = randomUUID();

    await submitAsGuest(game.id, itemIds, senderGuestId);

    const { data: submissionRaw, error: getResultsErr } = await supabase.rpc(
      "get_results",
      { p_tierlist_id: game.id, p_guest_id: senderGuestId },
    );
    expect(getResultsErr).toBeNull();
    const submissionId = (submissionRaw as { submission_id: string }).submission_id;
    expect(submissionId).toBeTruthy();

    const { data: token, error: createErr } = await supabase.rpc("create_share", {
      p_submission_id: submissionId,
      p_guest_id: senderGuestId,
    });
    expect(createErr).toBeNull();
    if (!token) throw new Error("expected create_share to return a token");
    expect(token).toMatch(/^[0-9a-f]{32}$/);

    // Before the recipient has played: locked teaser only.
    const { data: lockedRaw, error: lockedErr } = await supabase.rpc("get_share", {
      p_token: token,
      p_guest_id: recipientGuestId,
    });
    expect(lockedErr).toBeNull();
    const locked = mapShare(lockedRaw);
    expect(locked?.locked).toBe(true);
    expect(locked?.ranking).toBeNull();
    expect(locked?.tierlistSlug).toBe(game.slug);

    // After the recipient submits the represented game: unlocked, with the
    // sender's real ranking.
    await submitAsGuest(game.id, itemIds, recipientGuestId);
    const { data: unlockedRaw, error: unlockedErr } = await supabase.rpc("get_share", {
      p_token: token,
      p_guest_id: recipientGuestId,
    });
    expect(unlockedErr).toBeNull();
    const unlocked = mapShare(unlockedRaw);
    expect(unlocked?.locked).toBe(false);
    expect(unlocked?.ranking).toHaveLength(itemIds.length);

    // A third, uninvolved identity stays locked.
    const { data: strangerRaw } = await supabase.rpc("get_share", {
      p_token: token,
      p_guest_id: randomUUID(),
    });
    expect(mapShare(strangerRaw)?.locked).toBe(true);

    // An unknown token maps to null, same as `getShare()` would return.
    const { data: notFoundRaw } = await supabase.rpc("get_share", {
      p_token: "0".repeat(32),
    });
    expect(mapShare(notFoundRaw)).toBeNull();
  });

  it("a slug lookup (what getTierlistIdBySlug does) resolves the live game's real id", async () => {
    const game = await liveGame();
    const { data, error } = await supabase
      .from("tierlists")
      .select("id")
      .eq("slug", game.slug)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(game.id);
  });
});
