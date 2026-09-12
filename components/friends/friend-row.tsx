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
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();

  if (removed) return null;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <AvatarPlaceholder name={friend.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{friend.displayName}</p>
        <p className="truncate text-xs text-muted">
          @{friend.username}
          {played !== null ? ` · ${played ? "Played today" : "Hasn’t played yet"}` : ""}
        </p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">Remove?</span>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await removeFriend({ userId: friend.id });
                setRemoved(true);
              })
            }
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
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
