"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { updateTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Edit a draft/scheduled tierlist's title/prompt/slug (Milestone 8). A plain
 * RLS-gated `UPDATE` restricted to exactly those three columns by the
 * column-level grant (migration 8) — `status`/`release_date`/`tier_config`
 * can only change through their dedicated RPCs. Once the tierlist has any
 * official submission, the historical-lock trigger rejects this
 * unconditionally (`restrict_violation`, mapped to `locked` below) — the
 * database is the actual authority, not this action.
 */

export type UpdateTierlistResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "taken" | "locked" | "network" };

export async function updateTierlist(input: unknown): Promise<UpdateTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = updateTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tierlists")
      .update({
        slug: parsed.data.slug,
        title: parsed.data.title,
        prompt: parsed.data.prompt ?? null,
      })
      .eq("id", parsed.data.id);

    if (error) {
      if (error.code === "23505") return { ok: false, reason: "taken" };
      if (error.code === "23001") return { ok: false, reason: "locked" };
      console.error(`[update-tierlist] update failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }

    revalidatePath(`/admin/tierlists/${parsed.data.id}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[update-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
