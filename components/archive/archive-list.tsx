import Link from "next/link";
import { formatDateOnly } from "@/lib/game/format-date";
import type { ArchiveEntry } from "@/lib/game/archive-schema";

/**
 * Read-only browse of past Rankles (Milestone 9). Each row is a link only
 * when there's somewhere safe to send the visitor:
 *  - today's Rankle -> `/` (the real play/results flow, never a duplicate
 *    "play again" path)
 *  - a past Rankle the viewer has already played -> their own existing
 *    `/history/[submissionId]` (no new detail route)
 *  - anything else (unplayed past Rankle, or a guest) -> plain text, no
 *    link -- there is no submission path to old games, by design.
 */
export function ArchiveList({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted">No past Rankles yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const href = entry.isToday
          ? "/"
          : entry.played && entry.submissionId
            ? `/history/${entry.submissionId}`
            : null;

        const content = (
          <>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-base font-extrabold text-foreground">
                {entry.title}
              </span>
              <span className="text-xs text-muted">{formatDateOnly(entry.releaseDate)}</span>
            </div>
            <span className="shrink-0 text-xs font-semibold text-muted">
              {entry.isToday ? "Today" : entry.played === true ? "Played" : entry.played === false ? "Not played" : null}
            </span>
          </>
        );

        return (
          <li key={entry.tierlistId}>
            {href ? (
              <Link
                href={href}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 opacity-80">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
