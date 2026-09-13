"use server";

import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { createTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Create a new draft (Milestone 8). A plain RLS-gated `INSERT` — no RPC
 * needed, same "simple metadata CRUD" precedent as `update-profile.ts`. The
 * insert column list is deliberately `(slug, title, prompt, created_by)`
 * only: `status`/`release_date`/`tier_config` are not in the column-level
 * INSERT grant (migration 8), so they always take their table defaults —
 * every new game is a `draft` on the canonical S/A/B/C/F/N/A scale
 * (Decision 5), with no release date, regardless of what a client sends.
 */

export type CreateTierlistResult =
  | { ok: true; id: string }
  | { ok: false; reason: "forbidden" | "invalid" | "taken" | "network" };

export async function createTierlist(input: unknown): Promise<CreateTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = createTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("tierlists")
      .insert({
        slug: parsed.data.slug,
        title: parsed.data.title,
        prompt: parsed.data.prompt ?? null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return { ok: false, reason: "taken" };
      console.error(`[create-tierlist] insert failed code=${error.code ?? "?"}`);
      return { ok: false, reason: "network" };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[create-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

/** Server Action form target: create, then land on the new draft's editor. */
export async function createTierlistAndRedirect(formData: FormData) {
  const result = await createTierlist({
    slug: formData.get("slug"),
    title: formData.get("title"),
    prompt: formData.get("prompt") || undefined,
  });
  if (result.ok) redirect(`/admin/tierlists/${result.id}`);
  redirect(`/admin/tierlists/new?error=${result.reason}`);
}
