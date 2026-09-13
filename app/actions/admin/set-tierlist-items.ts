"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { setTierlistItemsSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Replace a tierlist's full item set — add/remove/rename/reorder/image in
 * one atomic call (Milestone 8). `set_tierlist_items()` is a full replace
 * (delete-then-reinsert in one transaction), not a merge: item ids are never
 * accepted from the client. Blocked once the tierlist has any official
 * submission (the historical lock).
 */

export type SetTierlistItemsResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "locked" | "not_found" | "network" };

export async function setTierlistItems(input: unknown): Promise<SetTierlistItemsResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = setTierlistItemsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_tierlist_items", {
      p_tierlist_id: parsed.data.id,
      p_items: parsed.data.items.map((item) => ({
        label: item.label,
        image_url: item.imageUrl ?? null,
        sort_order: item.sortOrder,
      })),
    });

    if (error) {
      const reason =
        error.code === "23001" ? "locked" : error.code === "P0002" ? "not_found" : error.code === "42501" ? "forbidden" : "network";
      console.error(`[set-tierlist-items] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`);
      return { ok: false, reason };
    }

    revalidatePath(`/admin/tierlists/${parsed.data.id}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[set-tierlist-items] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}
