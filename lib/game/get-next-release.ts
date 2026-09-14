import { createClient } from "@/lib/supabase/server";

/**
 * The next future scheduled release date, or `null` if nothing is
 * scheduled (Milestone 9). Thin wrapper around `get_next_release_date()` —
 * a `SECURITY DEFINER` RPC that returns ONLY a bare date, never title/slug/
 * prompt/item data (docs/SECURITY.md: no future-content leak). Any failure
 * also returns `null` — a display nicety, not a trust boundary.
 */
export async function getNextReleaseDate(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_next_release_date");
    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.error("[countdown] getNextReleaseDate failed", err);
    return null;
  }
}
