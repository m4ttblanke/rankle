"use client";

import { useState, useTransition } from "react";
import { cancelFriendRequest } from "@/app/actions/cancel-friend-request";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import type { FriendRequestEntry } from "@/lib/game/friends-schema";

/** One outgoing (sent-by-me) pending request row — the sender may retract it
 *  at any time; only the recipient can accept/decline (that's their row in
 *  IncomingRequestRow, not this one). */
export function OutgoingRequestRow({ entry }: { entry: FriendRequestEntry }) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [, startTransition] = useTransition();

  if (status === "done") return null;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <AvatarPlaceholder name={entry.user.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{entry.user.displayName}</p>
        <p className="truncate text-xs text-muted">@{entry.user.username} · Requested</p>
      </div>
      <button
        type="button"
        disabled={status === "busy"}
        onClick={() => {
          setStatus("busy");
          startTransition(async () => {
            const result = await cancelFriendRequest({ requestId: entry.requestId });
            setStatus(result.ok ? "done" : "error");
          });
        }}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        Cancel
      </button>
      <p role="alert" className="sr-only">
        {status === "error" ? "Something went wrong — try again." : ""}
      </p>
    </li>
  );
}
