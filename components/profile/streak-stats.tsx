import type { StreakSummary } from "@/lib/game/streaks";

/**
 * Current streak, longest streak, total played (Milestone 9) — the exact
 * three numbers docs/MANUAL.md sec 15 asks for, no more (no badges, no XP).
 * "Rankles," never "days," since a scheduling gap never breaks a streak.
 */
export function StreakStats({ streak }: { streak: StreakSummary }) {
  const stats: Array<[string, number]> = [
    ["Current streak", streak.current],
    ["Longest streak", streak.longest],
    ["Total played", streak.totalPlayed],
  ];

  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface p-3 text-center"
        >
          <dd className="font-display text-2xl font-extrabold tabular-nums text-foreground">
            {value}
          </dd>
          <dt className="text-xs text-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
}
