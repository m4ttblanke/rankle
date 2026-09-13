"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { unscheduleTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Emergency-unschedule a future scheduled game back to draft (Milestone 8).
 * `unschedule_tierlist()` only succeeds for a `scheduled` game whose
 * `release_date` is strictly in the future — "future only" already implies
 * zero submissions, since `submit_ranking` only ever accepts the CURRENT
 * game (never a future one). Frees the release date for reuse.
 */

export type UnscheduleTierlistResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "not_future" | "network" };

export async function unscheduleTierlist(input: unknown): Promise<UnscheduleTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = unscheduleTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("unschedule_tierlist", { p_tierlist_id: parsed.data.id });

    if (error) {
      const reason = error.code === "P0002" ? "not_future" : error.code === "42501" ? "forbidden" : "network";
      console.error(`[unschedule-tierlist] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`);
      return { ok: false, reason };
    }

    revalidatePath(`/admin/tierlists/${parsed.data.id}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[unschedule-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
