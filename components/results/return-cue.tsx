import { NextReleaseCountdown } from "@/components/game/next-release-countdown";
import type { CountdownState } from "@/lib/game/countdown";
import type { StreakSummary } from "@/lib/game/streaks";

/**
 * The M9 "return tomorrow" touchpoint — deliberately the last thing on the
 * results reveal, after sharing. Streak copy avoids implying consecutive
 * CALENDAR days (a scheduling gap doesn't break it — docs/MANUAL.md sec 15),
 * so it reads "N Rankles in a row," never "N day streak." Omitted entirely
 * for a signed-out visitor (`streak` is `null`) rather than shown empty —
 * guests get the countdown only, no streak claim to make.
 */
export function ReturnCue({
  streak,
  countdown,
}: {
  streak: StreakSummary | null;
  countdown: CountdownState;
}) {
  return (
    <section
      aria-labelledby="return-heading"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-muted p-4"
    >
      <h2 id="return-heading" className="font-display text-lg font-extrabold text-foreground">
        Come back tomorrow
      </h2>
      {streak && streak.current > 0 ? (
        <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
          {streak.current} Rankle{streak.current === 1 ? "" : "s"} in a row
        </p>
      ) : null}
      <NextReleaseCountdown state={countdown} />
    </section>
  );
}
