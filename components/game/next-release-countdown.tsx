"use client";

import { useEffect, useState } from "react";
import type { CountdownState } from "@/lib/game/countdown";
import { formatRemaining } from "@/lib/game/countdown";
import { formatDateOnly } from "@/lib/game/format-date";

/**
 * The M9 return cue: "come back tomorrow," made concrete. `state` is
 * computed server-side (`computeCountdown`, fed by the
 * `get_next_release_date()` RPC) so the browser's own timezone can never
 * change which Rankle boundary is being represented — this component only
 * ever ticks a clock toward an already-decided target instant.
 *
 * Hydration-safe by construction: `remaining` starts `null` on both server
 * and client, so the first paint is identical either way; the live minute
 * tick only starts after mount, in an effect.
 */
export function NextReleaseCountdown({ state }: { state: CountdownState }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (state.kind !== "tomorrow") return;
    const target = new Date(state.targetInstant).getTime();
    function tick() {
      setRemainingMs(target - Date.now());
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [state]);

  if (state.kind === "none") {
    return <p className="text-sm text-muted">Come back for the next Rankle.</p>;
  }

  if (state.kind === "later") {
    return (
      <p className="text-sm text-muted">
        Next Rankle: {formatDateOnly(state.releaseDate)}.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted" aria-live="off">
      {remainingMs === null ? "Next Rankle tomorrow." : `Next Rankle in ${formatRemaining(remainingMs)}.`}
    </p>
  );
}
