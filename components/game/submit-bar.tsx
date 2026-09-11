"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitRanking } from "@/app/actions/submit-ranking";
import { toSubmissionPayload, type RankingState } from "@/lib/game/ranking";
import type { DailyGame } from "@/lib/game/schema";

type Phase = "idle" | "confirming" | "submitting" | "error";
type ErrorReason = "invalid" | "closed" | "network";

const ERROR_COPY: Record<ErrorReason, string> = {
  invalid:
    "That ranking didn’t go through. Give it another look, then try again.",
  closed: "Today’s game just closed for submissions.",
  network: "Couldn’t reach the server. Your ranking is safe — try again.",
};

type Props = {
  game: DailyGame;
  /** The single source of truth for the ranking; the payload is derived from it
   *  only at submit time (never a second representation). */
  state: RankingState;
  complete: boolean;
  remaining: number;
  /** Freeze the board while a submit is in flight. */
  onSubmitting: (submitting: boolean) => void;
  /** Called once the database confirms an official submission exists for this
   *  identity — either a fresh success or a detected duplicate — never
   *  optimistically. Both outcomes mean the same thing to the caller: go to
   *  results. */
  onSubmitted: () => void;
};

/**
 * The "lock it in" control (Milestone 3). Lightweight inline confirmation — no
 * modal (docs/DESIGN.md sec 15). Success is shown only after the server
 * confirms; a failure keeps the ranking intact for a retry; a request in flight
 * cannot be triggered again.
 */
export function SubmitBar({
  game,
  state,
  complete,
  remaining,
  onSubmitting,
  onSubmitted,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason | null>(null);
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // When completeness flips either way (an item pulled out of the tiers, or the
  // last one placed), reset to the plain CTA so a stale confirm/error step can
  // never resurface. This is the sanctioned "adjust state while rendering"
  // pattern — cheaper and less surprising than an effect.
  const [prevComplete, setPrevComplete] = useState(complete);
  if (prevComplete !== complete) {
    setPrevComplete(complete);
    if (phase === "confirming" || phase === "error") setPhase("idle");
    setErrorReason(null);
  }

  // Move focus onto the confirm button when the confirmation step appears.
  useEffect(() => {
    if (phase === "confirming") confirmBtnRef.current?.focus();
  }, [phase]);

  function doSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setErrorReason(null);
    setPhase("submitting");
    onSubmitting(true);

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof submitRanking>>;
      try {
        result = await submitRanking({
          tierlistId: game.id,
          items: toSubmissionPayload(state, game),
        });
      } catch {
        result = { ok: false, reason: "network" };
      }
      inFlight.current = false;

      if (result.ok) {
        onSubmitted();
        return;
      }
      if (result.reason === "already") {
        onSubmitted();
        return;
      }
      onSubmitting(false);
      setErrorReason(result.reason);
      setPhase("error");
    });
  }

  function cancel() {
    setPhase("idle");
    setErrorReason(null);
    submitBtnRef.current?.focus();
  }

  if (!complete) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-md border border-border bg-surface-muted px-4 py-3 text-center text-sm font-semibold text-muted"
      >
        Rank all items first
        {remaining > 0 ? ` — ${remaining} to go` : ""}
      </button>
    );
  }

  if (phase === "submitting") {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-display text-base font-extrabold text-accent-foreground opacity-90"
      >
        <Spinner />
        Submitting…
      </button>
    );
  }

  if (phase === "confirming") {
    return (
      <div
        className="flex flex-col gap-2"
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
      >
        <p className="text-center text-xs text-muted">
          This locks your ranking for good — no changes after.
        </p>
        <div className="flex gap-2">
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={doSubmit}
            className="flex-1 rounded-md bg-accent px-4 py-3 font-display text-base font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Lock it in
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // idle or error
  return (
    <div className="flex flex-col gap-2">
      {phase === "error" && errorReason ? (
        <p
          role="alert"
          className="rounded-md border border-tier-s-border/40 bg-tier-s/[0.06] px-3 py-2 text-center text-sm text-foreground"
        >
          {ERROR_COPY[errorReason]}
        </p>
      ) : null}
      <button
        ref={submitBtnRef}
        type="button"
        onClick={() => setPhase("confirming")}
        className="w-full rounded-md bg-accent px-4 py-3 font-display text-base font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {phase === "error" ? "Try again" : "Submit ranking"}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M8 1.5a6.5 6.5 0 1 1-6.5 6.5" />
    </svg>
  );
}
