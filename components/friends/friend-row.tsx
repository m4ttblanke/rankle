"use client";

import { useState, useTransition } from "react";
import { removeFriend } from "@/app/actions/remove-friend";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import type { Friend } from "@/lib/game/friends";

/**
 * One accepted-friend row. `played` is `null` when there is no live game
 * today (nothing to report) — otherwise a plain "Played today" / "Hasn't
 * played yet" boolean signal only, never ranking detail (docs/MANUAL.md sec
 * 17). Remove uses the same lightweight inline-confirm swap as the ranking
 * board's submit control — no modal (docs/DESIGN.md sec 15).
 */
export function FriendRow({ friend, played }: { friend: Friend; played: boolean | null }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "removed" | "error">("idle");
  const [, startTransition] = useTransition();

  if (status === "removed") return null;

  function confirmRemove() {
    setStatus("busy");
    startTransition(async () => {
      const result = await removeFriend({ userId: friend.id });
      // Only enter the removed state once the server actually confirms it —
      // a failed request must leave the friendship (and this row) intact.
      setStatus(result.ok ? "removed" : "error");
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <AvatarPlaceholder name={friend.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{friend.displayName}</p>
        <p className="truncate text-xs text-muted">
          @{friend.username}
          {played !== null ? ` · ${played ? "Played today" : "Hasn’t played yet"}` : ""}
        </p>
        {status === "error" ? (
          <p role="alert" className="mt-0.5 text-xs font-semibold text-foreground">
            Couldn&rsquo;t remove — try again.
          </p>
        ) : null}
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">Remove?</span>
          <button
            type="button"
            disabled={status === "busy"}
            onClick={confirmRemove}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setStatus("idle");
            }}
            className="text-xs text-muted underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          Remove
        </button>
      )}
    </li>
  );
}
