import Link from "next/link";
import { getCurrentDailyGameId, listTierlistsForAdmin } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * Admin dashboard (Milestone 8). Answers, in order: what's live, what's
 * next, what's still a draft — a focused publishing tool, not a general
 * CMS (docs/MANUAL.md sec 27-28). "Live today" is computed by comparing each
 * row's id against `get_daily_game()`'s own id, the same caller-independent
 * resolver the homepage uses, so this page can never disagree with what a
 * player actually sees.
 *
 * A chronological "Upcoming" list stands in for a calendar grid (docs/
 * DESIGN.md sec 28 prefers this at M8's scale) — an empty list is itself the
 * "gap" signal: nothing is scheduled after today, so the current game keeps
 * running with no cron needed.
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const [tierlists, currentId] = await Promise.all([listTierlistsForAdmin(), getCurrentDailyGameId()]);

  const current = tierlists.find((t) => t.id === currentId) ?? null;
  const drafts = tierlists.filter((t) => t.status === "draft");
  const upcoming = tierlists
    .filter(
      (t) =>
        t.id !== currentId &&
        t.status === "scheduled" &&
        t.releaseDate &&
        (!current?.releaseDate || t.releaseDate > current.releaseDate),
    )
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));
  const past = tierlists.filter(
    (t) => t.id !== currentId && t.status === "scheduled" && t.releaseDate && (!current?.releaseDate || t.releaseDate <= current.releaseDate),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Admin</h1>
        <Link
          href="/admin/tierlists/new"
          className="rounded-md bg-accent px-4 py-2 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          + New Rankle
        </Link>
      </div>

      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <h2 id="today-heading" className="font-display text-lg font-extrabold text-foreground">
          Today
        </h2>
        {current ? (
          <TierlistRow tierlist={current} badge="Live today" />
        ) : (
          <EmptyRow>No Rankle is live today.</EmptyRow>
        )}
      </section>

      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-3">
        <h2 id="upcoming-heading" className="font-display text-lg font-extrabold text-foreground">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyRow>
            Nothing scheduled next — today&rsquo;s Rankle keeps running until you schedule another.
          </EmptyRow>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((t) => (
              <li key={t.id}>
                <TierlistRow tierlist={t} badge={t.releaseDate ?? "Scheduled"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="drafts-heading" className="flex flex-col gap-3">
        <h2 id="drafts-heading" className="font-display text-lg font-extrabold text-foreground">
          Drafts
        </h2>
        {drafts.length === 0 ? (
          <EmptyRow>No unscheduled drafts.</EmptyRow>
        ) : (
          <ul className="flex flex-col gap-2">
            {drafts.map((t) => (
              <li key={t.id}>
                <TierlistRow tierlist={t} badge="Draft" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading" className="flex flex-col gap-3">
          <h2 id="past-heading" className="font-display text-lg font-extrabold text-foreground">
            Past
          </h2>
          <ul className="flex flex-col gap-2">
            {past.map((t) => (
              <li key={t.id}>
                <TierlistRow tierlist={t} badge={t.releaseDate ?? "Past"} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TierlistRow({
  tierlist,
  badge,
}: {
  tierlist: { id: string; title: string; slug: string; itemCount: number; submissionCount: number };
  badge: string;
}) {
  return (
    <Link
      href={`/admin/tierlists/${tierlist.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tierlist.title}</p>
        <p className="truncate text-xs text-muted">
          /{tierlist.slug} · {tierlist.itemCount} item{tierlist.itemCount === 1 ? "" : "s"} ·{" "}
          {tierlist.submissionCount} submission{tierlist.submissionCount === 1 ? "" : "s"}
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {badge}
      </span>
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-surface-muted p-3 text-sm text-muted">{children}</p>;
}
