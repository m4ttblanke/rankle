"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { friendSearch } from "@/app/actions/friend-search";
import { sendFriendRequest } from "@/app/actions/send-friend-request";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import type { Relationship, SearchResult } from "@/lib/game/friends-schema";

const BUTTON_LABEL: Record<Relationship, string> = {
  none: "Add",
  pending_outgoing: "Requested",
  pending_incoming: "Respond below",
  friends: "Friends",
};

/**
 * Username search + send-request (Milestone 7). Debounced type-ahead calling
 * the `friendSearch` Server Action (`search_profiles` RPC does every real
 * authorization/cap/normalization decision — this is just the input). A
 * result's button reflects its `relationship` so a repeat search never
 * invites a duplicate request; tapping "Add" optimistically disables the
 * button, then reconciles with the server's actual status (idempotent
 * either way — `send_friend_request` itself never proliferates rows).
 */
export function FriendSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const [, startTransition] = useTransition();
  const latestQueryToken = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Nothing to fetch. Rendering below gates on query length directly
      // rather than clearing state here (avoids a setState-in-effect that
      // would otherwise fire on every keystroke down to an empty box).
      return;
    }

    const token = ++latestQueryToken.current;
    const timer = setTimeout(() => {
      setStatus("searching");
      startTransition(async () => {
        const result = await friendSearch({ query: trimmed });
        if (token !== latestQueryToken.current) return; // a newer query already superseded this one
        if (result.ok) {
          setResults(result.results);
          setStatus("idle");
        } else {
          setStatus("error");
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleAdd(id: string) {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, relationship: "pending_outgoing" } : r)),
    );
    startTransition(async () => {
      const result = await sendFriendRequest({ recipientId: id });
      setResults((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          if (!result.ok) return { ...r, relationship: "none" };
          return { ...r, relationship: result.status === "friends" ? "friends" : "pending_outgoing" };
        }),
      );
    });
  }

  const queryLongEnough = query.trim().length >= 2;
  // Gate on query length, not just `results.length` -- otherwise a stale
  // result set would keep rendering after the box is cleared back down
  // below the minimum length (state is intentionally left untouched when
  // the query drops below 2 chars; see the effect above).
  const visibleResults = queryLongEnough ? results : [];
  const showEmpty = status === "idle" && queryLongEnough && visibleResults.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
          Search by username
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. matt"
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status === "searching"
          ? "Searching…"
          : status === "error"
            ? "Search failed"
            : queryLongEnough
              ? `${visibleResults.length} result${visibleResults.length === 1 ? "" : "s"}`
              : ""}
      </p>

      {status === "error" ? (
        <p className="text-xs text-muted">Couldn’t search right now — try again.</p>
      ) : null}

      {showEmpty ? <p className="text-xs text-muted">No matching users.</p> : null}

      {visibleResults.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleResults.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <AvatarPlaceholder name={r.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{r.displayName}</p>
                <p className="truncate text-xs text-muted">@{r.username}</p>
              </div>
              <button
                type="button"
                disabled={r.relationship !== "none"}
                onClick={() => handleAdd(r.id)}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                {BUTTON_LABEL[r.relationship]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
