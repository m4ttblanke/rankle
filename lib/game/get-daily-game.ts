import { createClient } from "@/lib/supabase/server";
import { type DailyGame, mapDailyGame } from "./schema";

export class DailyGameError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DailyGameError";
  }
}

/**
 * Resolve the current daily game: the most recently released game whose
 * release date has arrived, in the canonical timezone (`America/Los_Angeles`).
 *
 * Milestone 8: this now calls `get_daily_game()`, a SECURITY DEFINER RPC
 * built on `private.current_daily_game_id()` — the one authoritative,
 * caller-independent resolver. Before M8, this ran a raw `tierlists` query
 * relying on RLS (`private.is_tierlist_public`) to filter by release date;
 * that filter is bypassed for an admin caller (`tierlists_select_public_or_admin`
 * intentionally grants admins unrestricted SELECT for the admin dashboard), so
 * an admin visiting this same query directly could have resolved a different,
 * future game than every other visitor once scheduling produced one. The RPC
 * ignores caller identity entirely, so admin/authenticated/anon always agree
 * (docs/SECURITY.md sec 13).
 *
 * Returns `null` when no game is currently live (the empty state).
 */
export async function getDailyGame(): Promise<DailyGame | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_daily_game");

  if (error) {
    throw new DailyGameError("Could not load today's game.", { cause: error });
  }
  if (!data) return null;

  try {
    return mapDailyGame(data);
  } catch (cause) {
    throw new DailyGameError("Today's game data is malformed.", { cause });
  }
}
