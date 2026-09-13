import { RankableCard } from "@/components/game/rankable-card";
import { tierStyle } from "@/components/game/tier-style";
import type { GameItem } from "@/lib/game/schema";

/**
 * Admin preview (Milestone 8) — reuses the actual player-facing `RankableCard`
 * (a plain presentational component, no dnd-kit dependency) so the item
 * catalog looks exactly as a player would see it before ranking, rather than
 * duplicating that visual treatment. Deliberately does not reuse the full
 * interactive `RankingBoard` (drag/reorder state machine): this is a
 * read-only "does this look right" check, not gameplay — it never creates a
 * submission, guest identity, or public route (docs/SECURITY.md; this
 * component is only ever rendered behind `requireAdmin()`).
 */
export function AdminPreviewBoard({
  title,
  prompt,
  tierConfig,
  items,
}: {
  title: string;
  prompt: string | null;
  tierConfig: string[];
  items: GameItem[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-4">
      <div>
        <h3 className="font-display text-lg font-extrabold text-foreground">{title || "Untitled"}</h3>
        {prompt ? <p className="text-sm text-muted">{prompt}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Tiers">
        {tierConfig.map((tier) => {
          const st = tierStyle(tier);
          return (
            <span
              key={tier}
              className={`grid size-9 place-items-center rounded-lg border-2 font-display text-sm font-extrabold ${st.chip}`}
            >
              {tier}
            </span>
          );
        })}
      </div>

      <ul className="flex flex-col gap-2" aria-label="Items">
        {items.length === 0 ? (
          <li className="text-sm text-muted">No items yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <RankableCard item={item} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
