import { createClient } from "@/lib/supabase/server";
import {
  DAILY_GAME_SELECT,
  DAILY_GAME_STATUSES,
  type DailyGame,
  mapDailyGame,
} from "./schema";

export class DailyGameError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DailyGameError";
  }
}

/**
 * Resolve the current daily game: the most recently released, non-archived
 * published game.
 *
 * Release-date gating in the canonical timezone (`America/Los_Angeles`) is
 * enforced by Row Level Security (`private.is_tierlist_public`), so this query
 * does not compute "today" in app code. Runs under the anon/authenticated
 * client — never the service role — so that gate actually applies
 * (docs/SECURITY.md sec 5, sec 13).
 *
 * Returns `null` when no game is currently live (the empty state).
 */
export async function getDailyGame(): Promise<DailyGame | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tierlists")
    .select(DAILY_GAME_SELECT)
    .in("status", DAILY_GAME_STATUSES)
    .not("release_date", "is", null)
    .order("release_date", { ascending: false })
    .limit(1)
    .maybeSingle();

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
