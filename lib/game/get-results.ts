import { createClient } from "@/lib/supabase/server";
import { type GameResults, mapResults } from "./results-schema";

/**
 * Fetch community results for a game (Milestone 4).
 *
 * The spoiler gate is enforced by the `get_results` RPC itself (SECURITY
 * DEFINER; raises `42501` until this identity has an official submission for
 * this game — docs/SECURITY.md sec 7). This reader does not duplicate that
 * check; it treats "not eligible" the same as "any other failure" and simply
 * returns `null`, so the caller (the `/results` route) can redirect cleanly
 * instead of rendering an error. Runs under the RLS client (publishable key)
 * — never the service role.
 *
 * A `null` return means "do not render results" for any reason: not eligible,
 * game not found, or a transient failure. It never distinguishes those cases
 * to the caller, so there is no path where a failure mode leaks whether
 * results exist.
 */
export async function getResults(
  tierlistId: string,
  guestId: string | null,
): Promise<GameResults | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_results", {
      p_tierlist_id: tierlistId,
      p_guest_id: guestId ?? undefined,
    });

    if (error) {
      if (error.code !== "42501") {
        console.error(
          `[get-results] rpc failed game=${tierlistId} code=${error.code ?? "?"}`,
        );
      }
      return null;
    }

    return mapResults(data);
  } catch (err) {
    console.error("[get-results] unexpected failure", err);
    return null;
  }
}
