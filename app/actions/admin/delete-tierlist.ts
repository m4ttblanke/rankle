"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { deleteTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Delete a draft (Milestone 8). A plain RLS-gated `DELETE` — the
 * historical-lock trigger (migration 8) is the actual authority: it raises
 * `restrict_violation` (23001) unconditionally once the tierlist has any
 * official submission, which also proves deletion can never cascade into
 * real submission data.
 */

export type DeleteTierlistResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "locked" | "network" };

export async function deleteTierlist(input: unknown): Promise<DeleteTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = deleteTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tierlists").delete().eq("id", parsed.data.id);

    if (error) {
      if (error.code === "23001") return { ok: false, reason: "locked" };
      console.error(`[delete-tierlist] delete failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[delete-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

export async function deleteTierlistAndRedirect(id: string) {
  await deleteTierlist({ id });
  redirect("/admin");
}
