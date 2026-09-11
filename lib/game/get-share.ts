import { createClient } from "@/lib/supabase/server";
import { type ShareTeaser, mapShare, shareTokenSchema } from "./share-schema";

/**
 * Fetch a share's teaser (and, once eligible, the sender's ranking) for
 * Milestone 5's spoiler-safe share page.
 *
 * `null` means "render the generic invalid-link state" — for a malformed
 * token, an unknown token, a revoked share, or a transient failure. Exactly
 * like `getResults()` (`lib/game/get-results.ts`), this never distinguishes
 * those cases to the caller: there is no path where a failure mode leaks
 * which one occurred (docs/SECURITY.md sec 7, sec 8).
 *
 * The spoiler gate itself is `get_share`'s own job (SECURITY DEFINER); this
 * reader does not duplicate it. Runs under the RLS client — never the
 * service role.
 */
export async function getShare(
  token: string,
  guestId: string | null,
): Promise<ShareTeaser | null> {
  if (!shareTokenSchema.safeParse(token).success) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_share", {
      p_token: token,
      p_guest_id: guestId ?? undefined,
    });

    if (error) {
      console.error(`[get-share] rpc failed code=${error.code ?? "?"}`);
      return null;
    }

    return mapShare(data);
  } catch (err) {
    console.error("[get-share] unexpected failure", err);
    return null;
  }
}

/**
 * Resolve a tierlist's id from its slug, under the same public-read RLS
 * policy `getDailyGame()` relies on (`tierlists_select_public_or_admin` /
 * `is_tierlist_public` — live, scheduled, or archived). Used to look up the
 * uuid `get_results()` needs once a share visitor is eligible; `get_share()`'s
 * own teaser only ever exposes the slug, never the id (docs/MANUAL.md sec 21:
 * the teaser is intentionally minimal).
 *
 * Returns `null` if the game is not (or no longer) publicly readable — the
 * caller falls back to the same "wrapped up" state as an old/rotated game.
 */
export async function getTierlistIdBySlug(slug: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tierlists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data.id;
  } catch (err) {
    console.error("[get-share] tierlist lookup failed", err);
    return null;
  }
}
