"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { scheduleTierlist } from "@/app/actions/admin/schedule-tierlist";
import { unscheduleTierlist } from "@/app/actions/admin/unschedule-tierlist";

const SCHEDULE_ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Pick a valid date.",
  past: "Cannot schedule a Rankle in the past.",
  taken: "Another Rankle is already scheduled for that date.",
  locked: "This Rankle already has official submissions and can no longer be rescheduled.",
  not_found: "This Rankle can't be scheduled right now.",
  network: "Couldn't save — try again.",
};

const UNSCHEDULE_ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Something went wrong.",
  not_future: "Only a future scheduled Rankle can be unscheduled.",
  network: "Couldn't unschedule — try again.",
};

/**
 * Schedule / reschedule / unschedule (Milestone 8). Unschedule uses the same
 * lightweight inline-confirm swap as friend removal and the ranking board's
 * submit control — no modal (docs/DESIGN.md sec 15, sec 28).
 */
export function ScheduleControl({
  id,
  status,
  releaseDate,
  isFuture,
}: {
  id: string;
  status: string;
  releaseDate: string | null;
  isFuture: boolean;
}) {
  const router = useRouter();
  const [dateValue, setDateValue] = useState(releaseDate ?? "");
  const [status_, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnschedule, setConfirmingUnschedule] = useState(false);
  const [, startTransition] = useTransition();

  function schedule() {
    setStatus("saving");
    startTransition(async () => {
      const result = await scheduleTierlist({ id, releaseDate: dateValue });
      if (result.ok) {
        setStatus("idle");
        setError(null);
        router.refresh();
      } else {
        setStatus("error");
        setError(SCHEDULE_ERROR_COPY[result.reason] ?? SCHEDULE_ERROR_COPY.network);
      }
    });
  }

  function unschedule() {
    setStatus("saving");
    startTransition(async () => {
      const result = await unscheduleTierlist({ id });
      if (result.ok) {
        setStatus("idle");
        setError(null);
        setConfirmingUnschedule(false);
        router.refresh();
      } else {
        setStatus("error");
        setError(UNSCHEDULE_ERROR_COPY[result.reason] ?? UNSCHEDULE_ERROR_COPY.network);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground">Release date</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Release date</span>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <button
          type="button"
          onClick={schedule}
          disabled={status_ === "saving" || !dateValue}
          className="rounded-md bg-accent px-4 py-2 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70"
        >
          {status === "scheduled" ? "Reschedule" : "Schedule"}
        </button>

        {status === "scheduled" && isFuture ? (
          confirmingUnschedule ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Unschedule?</span>
              <button
                type="button"
                onClick={unschedule}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingUnschedule(false)}
                className="text-xs text-muted underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingUnschedule(true)}
              className="text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Unschedule
            </button>
          )
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-muted">
        {error ?? ""}
      </p>
    </div>
  );
}
