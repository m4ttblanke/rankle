import { notFound } from "next/navigation";
import { tierStyle } from "@/components/game/tier-style";
import { AppHeader } from "@/components/layout/app-header";
import { getSubmissionDetail, type SubmissionDetailItem } from "@/lib/game/history";
import { NA_TIER, tierWeight } from "@/lib/game/results";

type Params = { params: Promise<{ submissionId: string }> };

function Row({ item }: { item: SubmissionDetailItem }) {
  const style = tierStyle(item.tier);
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-md border-2 font-display text-sm font-extrabold ${style.chip}`}
      >
        {item.tier}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {item.label}
      </span>
    </li>
  );
}

/**
 * Read-only detail for one of the current user's own past submissions
 * (Milestone 6) — direct or claimed, ownership checked server-side in
 * `getSubmissionDetail`. Deliberately just the player's own placements, no
 * community comparison (that would re-build a mini `/results` for every
 * past game, and risks drifting toward M9's archive-browsing scope).
 *
 * `notFound()` covers "doesn't exist" and "not yours" identically — never
 * distinguished, same discipline as every other ownership check in this app.
 */
export default async function HistoryDetailPage({ params }: Params) {
  const { submissionId } = await params;
  const detail = await getSubmissionDetail(submissionId);
  if (!detail) notFound();

  const opinionItems = detail.items
    .filter((i) => i.tier !== NA_TIER)
    .sort((a, b) => {
      const diff =
        tierWeight(detail.tierConfig, b.tier) - tierWeight(detail.tierConfig, a.tier);
      return diff !== 0 ? diff : a.position - b.position;
    });
  const naItems = detail.items
    .filter((i) => i.tier === NA_TIER)
    .sort((a, b) => a.position - b.position);

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Your ranking
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {detail.tierlistTitle}
          </h1>
        </header>

        <ul className="flex flex-col gap-2">
          {opinionItems.map((item) => (
            <Row key={item.itemId} item={item} />
          ))}
        </ul>

        {naItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Haven&rsquo;t tried
            </p>
            <ul className="flex flex-col gap-2">
              {naItems.map((item) => (
                <Row key={item.itemId} item={item} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
