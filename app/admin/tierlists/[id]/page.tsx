import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPreviewBoard } from "@/components/admin/preview-board";
import { DangerZone } from "@/components/admin/danger-zone";
import { ItemEditor } from "@/components/admin/item-editor";
import { MetadataForm } from "@/components/admin/metadata-form";
import { ScheduleControl } from "@/components/admin/schedule-control";
import { getCurrentDailyGameId, getTierlistForAdmin } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * The tierlist editor (Milestone 8). Once `hasSubmissions` is true, the
 * database's historical-lock trigger rejects every mutation unconditionally
 * — this page reflects that by hiding the edit/schedule/delete controls
 * rather than rendering disabled forms whose submit would only ever fail
 * (docs/SECURITY.md: don't rely on the UI to enforce it, but don't invite a
 * doomed request either). Duplicate remains available regardless of status,
 * since duplicating never touches the source.
 */
export default async function AdminTierlistEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [tierlist, currentId] = await Promise.all([getTierlistForAdmin(id), getCurrentDailyGameId()]);
  if (!tierlist) notFound();

  const isCurrent = tierlist.id === currentId;
  const isFuture = Boolean(tierlist.releaseDate && !isCurrent && tierlist.status === "scheduled");
  const locked = tierlist.hasSubmissions;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-xs text-muted underline-offset-2 hover:underline">
          ← All Rankles
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            {tierlist.title}
          </h1>
          <StatusBadge status={tierlist.status} isCurrent={isCurrent} />
        </div>
        <p className="text-sm text-muted">
          {tierlist.submissionCount} official submission{tierlist.submissionCount === 1 ? "" : "s"}
          {tierlist.releaseDate ? ` · release date ${tierlist.releaseDate}` : " · no release date"}
        </p>
      </div>

      {locked ? (
        <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground">
          This Rankle has official submissions, so it&rsquo;s historical content now — title, prompt, items,
          tier scale, and release date are all frozen, and it can&rsquo;t be deleted. This is enforced by the
          database,
          not just this screen.
        </div>
      ) : null}

      {!locked ? (
        <section aria-labelledby="metadata-heading" className="flex flex-col gap-3">
          <h2 id="metadata-heading" className="font-display text-lg font-extrabold text-foreground">
            Details
          </h2>
          <MetadataForm id={tierlist.id} title={tierlist.title} prompt={tierlist.prompt} slug={tierlist.slug} />
        </section>
      ) : null}

      {!locked ? (
        <section aria-labelledby="schedule-heading" className="flex flex-col gap-3">
          <h2 id="schedule-heading" className="font-display text-lg font-extrabold text-foreground">
            Schedule
          </h2>
          <ScheduleControl
            id={tierlist.id}
            status={tierlist.status}
            releaseDate={tierlist.releaseDate}
            isFuture={isFuture}
          />
        </section>
      ) : null}

      <section aria-labelledby="items-heading" className="flex flex-col gap-3">
        <h2 id="items-heading" className="font-display text-lg font-extrabold text-foreground">
          Items
        </h2>
        {locked ? (
          <ul className="flex flex-col gap-2">
            {tierlist.items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground"
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <ItemEditor tierlistId={tierlist.id} initialItems={tierlist.items} />
        )}
      </section>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
        <h2 id="preview-heading" className="font-display text-lg font-extrabold text-foreground">
          Preview
        </h2>
        <AdminPreviewBoard
          title={tierlist.title}
          prompt={tierlist.prompt}
          tierConfig={tierlist.tierConfig}
          items={tierlist.items.map((it) => ({
            id: it.id,
            label: it.label,
            imageUrl: it.imageUrl,
            sortOrder: it.sortOrder,
          }))}
        />
      </section>

      <section aria-labelledby="danger-heading" className="flex flex-col gap-3">
        <h2 id="danger-heading" className="font-display text-lg font-extrabold text-foreground">
          More actions
        </h2>
        <DangerZone id={tierlist.id} slug={tierlist.slug} canDelete={!locked} />
      </section>
    </div>
  );
}

function StatusBadge({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  const label = isCurrent ? "Live today" : status === "scheduled" ? "Scheduled" : status;
  return (
    <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
      {label}
    </span>
  );
}
