import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import { DAILY_GAME_SELECT, DAILY_GAME_STATUSES, mapDailyGame } from "./schema";

/*
 * Read-only integration check for the daily-game query against the remote
 * project, from the app's publishable key. Runs the exact select/filter chain
 * the resolver uses (getDailyGame() itself can't run here — it needs Next's
 * request context for cookies()). Verifies column names, the embedded-resource
 * name, and the filter operators are all valid, and that RLS/grants let the
 * anon role run it.
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
