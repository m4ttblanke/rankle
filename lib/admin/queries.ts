import { createClient } from "@/lib/supabase/server";

/**
 * Admin read helpers (Milestone 8). All reads go through the existing
 * `tierlists_select_public_or_admin` / `tierlist_items_select_public_or_admin`
 * RLS policies, which already grant an admin unrestricted SELECT — no new
 * RLS was needed for admin reads (docs/SECURITY.md sec 4, migration 4).
 * Submission counts are a plain `count: "exact", head: true` query per game
 * — cheap at current scale (docs/MANUAL.md sec 32), no analytics
 * infrastructure.
 */

export type AdminTierlistSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  releaseDate: string | null;
  itemCount: number;
  submissionCount: number;
};

export type AdminTierlistItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  sortOrder: number;
};

export type AdminTierlistDetail = {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  status: string;
  releaseDate: string | null;
  tierConfig: string[];
  items: AdminTierlistItem[];
  submissionCount: number;
  hasSubmissions: boolean;
};

function toTierConfig(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Every tierlist (draft/scheduled/live/archived/disabled), newest release
 *  first, drafts (no release date) last. Powers the /admin dashboard. */
export async function listTierlistsForAdmin(): Promise<AdminTierlistSummary[]> {
  const supabase = await createClient();

  const { data: tierlists, error } = await supabase
    .from("tierlists")
    .select("id, slug, title, status, release_date, tierlist_items(id)")
    .order("release_date", { ascending: false, nullsFirst: false });

  if (error || !tierlists) return [];

  const ids = tierlists.map((t) => t.id);
  const counts = await getSubmissionCounts(ids);

  return tierlists.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    status: t.status,
    releaseDate: t.release_date,
    itemCount: t.tierlist_items?.length ?? 0,
    submissionCount: counts.get(t.id) ?? 0,
  }));
}

/** One tierlist with its items and submission count, for the editor. */
export async function getTierlistForAdmin(id: string): Promise<AdminTierlistDetail | null> {
  const supabase = await createClient();

  const { data: tierlist, error } = await supabase
    .from("tierlists")
    .select(
      "id, slug, title, prompt, status, release_date, tier_config, tierlist_items(id, label, image_url, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !tierlist) return null;

  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("tierlist_id", id);

  const items: AdminTierlistItem[] = [...(tierlist.tierlist_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => ({ id: it.id, label: it.label, imageUrl: it.image_url, sortOrder: it.sort_order }));

  return {
    id: tierlist.id,
    slug: tierlist.slug,
    title: tierlist.title,
    prompt: tierlist.prompt,
    status: tierlist.status,
    releaseDate: tierlist.release_date,
    tierConfig: toTierConfig(tierlist.tier_config),
    items,
    submissionCount: count ?? 0,
    hasSubmissions: (count ?? 0) > 0,
  };
}

/** The id of today's playable game, via the same caller-independent
 *  resolver the homepage uses (`get_daily_game()`) — so "LIVE TODAY" on the
 *  dashboard always agrees with what a player actually sees. */
export async function getCurrentDailyGameId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_daily_game");
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

async function getSubmissionCounts(tierlistIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (tierlistIds.length === 0) return counts;

  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("tierlist_id").in("tierlist_id", tierlistIds);

  for (const row of data ?? []) {
    counts.set(row.tierlist_id, (counts.get(row.tierlist_id) ?? 0) + 1);
  }
  return counts;
}
