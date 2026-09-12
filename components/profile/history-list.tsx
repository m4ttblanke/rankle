import Link from "next/link";
import { tierStyle } from "@/components/game/tier-style";
import type { HistoryEntry } from "@/lib/game/history-schema";

/** `releaseDate` is a DATE-only column (e.g. "2026-09-12"), which `new
 *  Date(...)` parses as UTC midnight — formatting that directly in a
 *  timezone behind UTC would show the previous day. Parsing as local
 *  midnight instead (no trailing "Z") avoids that shift. */
function formatDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The current user's history list (Milestone 6) — immutable official
 * submissions only, private to the owner. Each row shows the player's own
 * placement counts (reusing `tierStyle`, N/A rendered as "—" rather than a
 * tier letter, consistent with N/A's neutral treatment elsewhere).
 */
export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No completed Rankles yet — play today&rsquo;s to start your history.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.submissionId}>
          <Link
            href={`/history/${entry.submissionId}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-base font-extrabold text-foreground">
                {entry.tierlistTitle}
              </span>
              <span className="text-xs text-muted">
                {entry.releaseDate ? formatDate(entry.releaseDate) : "—"}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              {Object.entries(entry.tierCounts).map(([tier, count]) => (
                <span
                  key={tier}
                  title={`${tier}: ${count}`}
                  className={`grid size-7 place-items-center rounded-md border-2 font-display text-xs font-extrabold ${tierStyle(tier).chip}`}
                >
                  {tier === "N/A" ? "—" : tier}
                </span>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
