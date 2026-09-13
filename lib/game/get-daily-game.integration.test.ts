import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { DAILY_GAME_SELECT, DAILY_GAME_STATUSES, mapDailyGame } from "./schema";

/*
 * Read-only integration check against the remote project, from the app's
 * publishable key.
 *
 * Milestone 8: getDailyGame() itself now calls the get_daily_game() RPC, not
 * this raw table query (see docs/SECURITY.md sec 13 for why: RLS's admin
 * bypass on tierlists made the raw query caller-dependent). This file still
 * exercises the raw query/columns/RLS grant directly as a narrow smoke test
 * of the base table shape against the remote project, which has not yet
 * received the M8 migration — TODO once M8 ships remotely: add a companion
 * case that calls the get_daily_game() RPC instead/in addition.
 *
 * The remote DB has no games, so the expected result today is `null`. When an
 * isolated test database with fixtures exists, add cases for: ignores future
 * `scheduled`, ignores `draft`/`disabled`, picks the latest of several released
 * games (see docs/TODO.md).
 *
 * Skips when Supabase env vars are absent.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !publishableKey)(
  "daily-game query (read-only, remote)",
  () => {
    const supabase = createClient<Database>(url!, publishableKey!);

    it("executes without error and maps cleanly (currently no live game)", async () => {
      const { data, error } = await supabase
        .from("tierlists")
        .select(DAILY_GAME_SELECT)
        .in("status", DAILY_GAME_STATUSES)
        .not("release_date", "is", null)
        .order("release_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(error).toBeNull();

      if (data === null) {
        expect(data).toBeNull();
      } else {
        // If a game gets published later, the shape must still validate.
        expect(() => mapDailyGame(data)).not.toThrow();
      }
    });
  },
);
