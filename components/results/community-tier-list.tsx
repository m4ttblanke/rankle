import { tierStyle } from "@/components/game/tier-style";
import type { CommunityTierList as CommunityTierListData } from "@/lib/game/results";

/**
 * The community's aggregate tier list — a read-only echo of the ranking
 * board's own visual language (tier chip + lane), not a table of numbers
 * (docs/DESIGN.md sec 17). Unrated items get their own neutral shelf below
 * the S–F rows rather than being forced into F (M4 brief, COMMUNITY TIER
 * LIST section).
 */
export function CommunityTierList({
  tierList,
}: {
  tierList: CommunityTierListData;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {tierList.rows.map((row) => {
        const st = tierStyle(row.tier);
        return (
          <div key={row.tier} className="flex items-stretch gap-2">
            <span
              className={`grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xl border-2 px-1 font-display text-xl font-extrabold ${st.chip}`}
            >
              <span className="sr-only">Tier </span>
              {row.tier}
            </span>
            <ul
              aria-label={`Community tier ${row.tier}`}
              className={`flex min-h-12 flex-1 flex-wrap content-center gap-1.5 rounded-xl p-2 ring-1 ring-inset ring-border/60 ${st.lane}`}
            >
              {row.items.length === 0 ? (
                <li className="list-none px-1.5 py-1 text-xs text-muted">
                  Empty
                </li>
              ) : (
                row.items.map((item) => (
                  <li
                    key={item.itemId}
                    className="list-none rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium text-foreground"
                  >
                    {item.label}
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}

      {tierList.unrated.length > 0 ? (
        <div className="flex items-stretch gap-2">
          <span className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xl border-2 border-border bg-surface-muted px-1 text-center font-display text-[0.65rem] font-extrabold uppercase tracking-wide text-muted">
            N/A
          </span>
          <ul
            aria-label="Not yet rated by anyone"
            className="flex min-h-12 flex-1 flex-wrap content-center gap-1.5 rounded-xl bg-accent/[0.03] p-2 ring-1 ring-inset ring-border/60"
          >
            {tierList.unrated.map((item) => (
              <li
                key={item.itemId}
                className="list-none rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium text-foreground"
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
