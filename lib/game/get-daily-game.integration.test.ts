import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";
import { mapDailyGame } from "./schema";

/*
 * Integration checks for `get_daily_game()` — the RPC `getDailyGame()`
 * (lib/game/get-daily-game.ts) actually calls as of Milestone 8. Two
 * independent checks, each skipping itself when its own env is absent:
 *
 * 1. Remote (read-only, publishable key from `.env.local`) — a smoke test
 *    that the RPC is deployed and its public grants work against the real
 *    production project, mirroring `vitest.config.mts`'s comment about "the
 *    read-only Supabase RLS integration check". The remote project has no
 *    seeded games, so this can only assert "callable, no error, null or a
 *    clean shape" — it cannot exercise release-date resolution.
 *
 * 2. Local (`.env.test`, real seeded fixtures from `supabase/seed.sql`) —
 *    exercises the integration boundary that actually matters and that
 *    remote's empty data can't: the real `supabase-js` client, calling the
 *    real RPC, resolving the real seeded "current game" (today's live
 *    "Fast Food Fries", release_date = today) while correctly ignoring both
 *    a future-scheduled game ("Pixar Movies", tomorrow) and a past one
 *    ("Retro Snacks", archived, yesterday), with item ordering intact and
 *    the response shape parsing via the same `mapDailyGame()` the app uses.
 *    `private.current_daily_game_id()`'s own day-rollover/ordering logic is
 *    already exhaustively covered at the SQL level
 *    (`supabase/tests/rls_spec.sql` sec 11) — this does not re-test that
 *    resolver, only that the JS integration boundary built on top of it
 *    works end to end. Read-only: no rows are created or mutated, so this
 *    needs no cleanup and cannot race the shared-fixture integration tests
 *    (`vitest.config.mts`'s `integration-shared-current-game` project).
 */

const remoteUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!remoteUrl || !remotePublishableKey)(
  "get_daily_game (read-only, remote)",
  () => {
    const supabase = createClient<Database>(remoteUrl!, remotePublishableKey!);

    it("is callable by anon and maps cleanly (remote currently has no live game)", async () => {
      const { data, error } = await supabase.rpc("get_daily_game");
      expect(error).toBeNull();

      if (data === null) {
        expect(data).toBeNull();
      } else {
        expect(() => mapDailyGame(data)).not.toThrow();
      }
    });
  },
);

const localEnv = loadEnvTest();
const localUrl = localEnv.NEXT_PUBLIC_SUPABASE_URL;
const localKey = localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!localUrl || !localKey)(
  "get_daily_game (read-only, local seeded fixtures)",
  () => {
    if (localUrl) assertLoopbackUrl(localUrl);

    const supabase = createClient<Database>(localUrl!, localKey!);

    it("resolves today's seeded live game, not the future-scheduled or past-archived ones", async () => {
      const { data, error } = await supabase.rpc("get_daily_game");
      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const game = mapDailyGame(data);
      expect(game.slug).toBe("fast-food-fries");
      expect(game.slug).not.toBe("pixar-movies");
      expect(game.slug).not.toBe("retro-snacks");
    });

    it("returns items in sort_order and a shape that maps cleanly end to end", async () => {
      const { data, error } = await supabase.rpc("get_daily_game");
      expect(error).toBeNull();

      const game = mapDailyGame(data);
      const orders = game.items.map((i) => i.sortOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      expect(game.items.length).toBeGreaterThan(0);
      expect(game.items.every((i) => i.label.length > 0)).toBe(true);
    });

    it("is publicly callable without authentication (anon key, no session)", async () => {
      // `supabase` above already uses only the anon/publishable key with no
      // signed-in session — this is the public-visibility assertion itself,
      // exercised by every call in this block, made explicit here.
      const { data: session } = await supabase.auth.getSession();
      expect(session.session).toBeNull();

      const { error } = await supabase.rpc("get_daily_game");
      expect(error).toBeNull();
    });
  },
);
