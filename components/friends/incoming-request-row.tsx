"use client";

import { useState, useTransition } from "react";
import { acceptFriendRequest } from "@/app/actions/accept-friend-request";
import { declineFriendRequest } from "@/app/actions/decline-friend-request";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import type { FriendRequestEntry } from "@/lib/game/friends-schema";

/** One incoming request row — Accept creates the friendship, Decline drops
 *  it. Both delete the underlying row (no retained history); a resolved
 *  request simply disappears from the list rather than showing a dead state. */
export function IncomingRequestRow({ entry }: { entry: FriendRequestEntry }) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [, startTransition] = useTransition();

  function respond(kind: "accept" | "decline") {
    setStatus("busy");
    startTransition(async () => {
      const result =
        kind === "accept"
          ? await acceptFriendRequest({ requestId: entry.requestId })
          : await declineFriendRequest({ requestId: entry.requestId });
      setStatus(result.ok ? "done" : "error");
    });
  }

  if (status === "done") return null;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <AvatarPlaceholder name={entry.user.displayName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{entry.user.displayName}</p>
        <p className="truncate text-xs text-muted">@{entry.user.username}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={status === "busy"}
          onClick={() => respond("accept")}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={status === "busy"}
          onClick={() => respond("decline")}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          Decline
        </button>
      </div>
      <p role="alert" className="sr-only">
        {status === "error" ? "Something went wrong — try again." : ""}
      </p>
    </li>
  );
}
