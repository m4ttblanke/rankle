"use server";

import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { duplicateTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Duplicate an existing tierlist into a brand-new draft (Milestone 8).
 * `duplicate_tierlist()` gives the copy fresh tierlist/item ids and copies
 * title/prompt/tier_config/items — never release_date/status/submissions/
 * stats/shares. Works on ANY source status (including a live/archived game
 * with real submissions): duplicating never touches the source, so this is
 * safe even though the source itself may be historically locked.
 */

export type DuplicateTierlistResult =
  | { ok: true; id: string }
  | { ok: false; reason: "forbidden" | "invalid" | "taken" | "not_found" | "network" };

export async function duplicateTierlist(input: unknown): Promise<DuplicateTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = duplicateTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("duplicate_tierlist", {
      p_source_id: parsed.data.id,
      p_new_slug: parsed.data.newSlug,
    });

    if (error || !data) {
      const reason =
        error?.code === "23505"
          ? "taken"
          : error?.code === "P0002"
            ? "not_found"
            : error?.code === "42501"
              ? "forbidden"
              : "network";
      console.error(`[duplicate-tierlist] rpc rejected (reason=${reason}) code=${error?.code ?? "?"}`);
      return { ok: false, reason };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[duplicate-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
