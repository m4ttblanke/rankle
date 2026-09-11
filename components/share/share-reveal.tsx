import { tierStyle } from "@/components/game/tier-style";
import { CheckIcon } from "@/components/game/icons";
import { ShareButton } from "@/components/share/share-button";
import {
  compareRankings,
  type ComparisonRow,
} from "@/lib/game/share-comparison";
import type { GameResults } from "@/lib/game/results-schema";
import type { ShareTeaser } from "@/lib/game/share-schema";

type Props = {
  share: ShareTeaser;
  myResults: GameResults;
};

function Row({ row }: { row: ComparisonRow }) {
  const senderStyle = tierStyle(row.senderTier);
  const myStyle = row.myTier ? tierStyle(row.myTier) : null;

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {row.label}
      </span>
      <span
        title={`Sender: ${row.senderTier}`}
        className={`grid size-8 shrink-0 place-items-center rounded-md border-2 font-display text-sm font-extrabold ${senderStyle.chip}`}
      >
        {row.senderTier}
      </span>
      <span aria-hidden className="text-xs text-muted">
        vs
      </span>
      <span
        title={`You: ${row.myTier ?? "unranked"}`}
        className={`grid size-8 shrink-0 place-items-center rounded-md border-2 font-display text-sm font-extrabold ${myStyle ? myStyle.chip : "border-border bg-surface-muted text-muted"}`}
      >
        {row.myTier ?? "—"}
      </span>
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full ${row.same ? "bg-tier-c/20 text-tier-c-border" : "text-muted"}`}
      >
        {row.same ? <CheckIcon className="size-3.5" /> : null}
        <span className="sr-only">
          {row.same ? "Same placement" : "Different placement"}
        </span>
      </span>
    </li>
  );
}

/**
 * The post-play reveal (Milestone 5) — sender's ranking (from `get_share`,
 * already spoiler-gated) side by side with the recipient's own ranking (from
 * `get_results`, fetched only because this route already confirmed
 * eligibility). Reuses `tierStyle` / the N/A-neutral split rather than a new
 * visual system, matching `ComparisonList` on `/results`
 * (docs/DESIGN.md sec 16, sec 17).
 *
 * The stat below the heading is a literal same-tier count, never a weighted
 * "compatibility" score (docs/MANUAL.md sec 19 stays out of scope for M5) —
 * labeled "Same placement," not "agreed," because a shared N/A placement
 * means both sides abstained, not that they share an opinion.
 */
export function ShareReveal({ share, myResults }: Props) {
  const senderName = share.senderDisplayName || share.senderUsername || "They";
  const ranking = share.ranking ?? [];
  const comparison = compareRankings(
    ranking,
    myResults.myRanking,
    myResults.tierlist.tierConfig,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Revealed
        </span>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
          {share.tierlistTitle}
        </h1>
        <p className="text-sm text-muted">
          {senderName} vs. you — same placement on{" "}
          <span className="font-semibold text-foreground">
            {comparison.samePlacementCount} of {comparison.totalCount}
          </span>{" "}
          items.
        </p>
      </header>

      {comparison.opinionRows.length > 0 ? (
        <section aria-labelledby="compare-heading" className="flex flex-col gap-3">
          <h2
            id="compare-heading"
            className="font-display text-xl font-extrabold text-foreground"
          >
            {senderName} vs. you
          </h2>
          <ul className="flex flex-col gap-2">
            {comparison.opinionRows.map((row) => (
              <Row key={row.itemId} row={row} />
            ))}
          </ul>
        </section>
      ) : null}

      {comparison.naRows.length > 0 ? (
        <section aria-labelledby="na-heading" className="flex flex-col gap-3">
          <h2
            id="na-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Haven&rsquo;t tried
          </h2>
          <ul className="flex flex-col gap-2">
            {comparison.naRows.map((row) => (
              <Row key={row.itemId} row={row} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="share-onward-heading" className="flex flex-col gap-3">
        <h2
          id="share-onward-heading"
          className="font-display text-xl font-extrabold text-foreground"
        >
          Your turn to challenge someone
        </h2>
        <ShareButton
          submissionId={myResults.submissionId}
          gameTitle={myResults.tierlist.title}
        />
      </section>
    </div>
  );
}
