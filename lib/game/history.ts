import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  historyItemRowSchema,
  historySubmissionRowSchema,
  type HistoryEntry,
} from "./history-schema";

/**
 * The current user's own completed-game history (Milestone 6) — private to
 * the owner, immutable official submissions only (never drafts/unranked
 * state, which don't exist as rows at all once submitted).
 *
 * Combines direct submissions (`user_id = auth.uid()`) with claimed guest
 * submissions (`claimed_guest_submissions`) — both are plain RLS-gated reads
 * (`supabase/migrations/20260912000000_guest_account_claiming.sql` widened
 * the SELECT policies to recognize claimed ownership), no RPC needed.
 *
 * Any failure returns `[]` rather than throwing — history is a nice-to-have
 * profile feature, not a trust boundary the rest of the app depends on.
 */
export async function getMyHistory(): Promise<HistoryEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const supabase = await createClient();

    const [{ data: direct, error: directErr }, { data: claimedLinks, error: claimErr }] =
      await Promise.all([
        supabase
          .from("submissions")
          .select("id, submitted_at, tierlists(slug, title, release_date)")
          .eq("user_id", user.id),
        supabase
          .from("claimed_guest_submissions")
          .select("submission_id")
          .eq("user_id", user.id),
      ]);
    if (directErr || claimErr) throw directErr ?? claimErr;

    const claimedIds = (claimedLinks ?? []).map((c) => c.submission_id);
    let claimed: typeof direct = [];
    if (claimedIds.length > 0) {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, submitted_at, tierlists(slug, title, release_date)")
        .in("id", claimedIds);
      if (error) throw error;
      claimed = data ?? [];
    }

    const rows = [...(direct ?? []), ...claimed].map((row) =>
      historySubmissionRowSchema.parse(row),
    );
    const submissionIds = rows.map((r) => r.id);

    const tierCountsBySubmission = new Map<string, Record<string, number>>();
    if (submissionIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("submission_items")
        .select("submission_id, tier")
        .in("submission_id", submissionIds);
      if (itemsErr) throw itemsErr;
      for (const raw of items ?? []) {
        const item = historyItemRowSchema.parse(raw);
        const counts = tierCountsBySubmission.get(item.submission_id) ?? {};
        counts[item.tier] = (counts[item.tier] ?? 0) + 1;
        tierCountsBySubmission.set(item.submission_id, counts);
      }
    }

    const entries: HistoryEntry[] = rows.map((row) => ({
      submissionId: row.id,
      tierlistSlug: row.tierlists.slug,
      tierlistTitle: row.tierlists.title,
      releaseDate: row.tierlists.release_date,
      submittedAt: row.submitted_at,
      tierCounts: tierCountsBySubmission.get(row.id) ?? {},
    }));

    entries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return entries;
  } catch (err) {
    console.error("[history] getMyHistory failed", err);
    return [];
  }
}

export type SubmissionDetailItem = {
  itemId: string;
  label: string;
  imageUrl: string | null;
  tier: string;
  position: number;
};

export type SubmissionDetail = {
  submissionId: string;
  tierlistSlug: string;
  tierlistTitle: string;
  tierConfig: string[];
  submittedAt: string;
  items: SubmissionDetailItem[];
};

/**
 * Read-only detail for ONE of the current user's own past submissions
 * (direct or claimed) — `/history/[submissionId]`. Ownership is checked
 * here explicitly (IDOR discipline, docs/SECURITY.md sec 9) in addition to
 * RLS already restricting the underlying reads to the caller's own rows;
 * `null` for "not found, not owned, or any failure" — never distinguished,
 * same discipline as `getResults()` / `getShare()`.
 */
export async function getSubmissionDetail(
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const supabase = await createClient();

    const { data: subRaw, error: subErr } = await supabase
      .from("submissions")
      .select("id, submitted_at, user_id, tierlists(slug, title, tier_config)")
      .eq("id", submissionId)
      .maybeSingle();
    if (subErr || !subRaw) return null;

    if (subRaw.user_id !== user.id) {
      const { data: claim } = await supabase
        .from("claimed_guest_submissions")
        .select("submission_id")
        .eq("submission_id", submissionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!claim) return null;
    }

    const { data: itemRows, error: itemsErr } = await supabase
      .from("submission_items")
      .select("tier, position, tierlist_items(id, label, image_url)")
      .eq("submission_id", submissionId);
    if (itemsErr) return null;

    const tierlist = subRaw.tierlists as unknown as {
      slug: string;
      title: string;
      tier_config: unknown;
    };

    const items: SubmissionDetailItem[] = (itemRows ?? [])
      .map((row) => {
        const ti = row.tierlist_items as unknown as {
          id: string;
          label: string;
          image_url: string | null;
        } | null;
        if (!ti) return null;
        return {
          itemId: ti.id,
          label: ti.label,
          imageUrl: ti.image_url,
          tier: row.tier,
          position: row.position,
        };
      })
      .filter((x): x is SubmissionDetailItem => x !== null);

    return {
      submissionId: subRaw.id,
      tierlistSlug: tierlist.slug,
      tierlistTitle: tierlist.title,
      tierConfig: Array.isArray(tierlist.tier_config)
        ? (tierlist.tier_config as string[])
        : [],
      submittedAt: subRaw.submitted_at,
      items,
    };
  } catch (err) {
    console.error("[history] getSubmissionDetail failed", err);
    return null;
  }
}
