"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createShare } from "@/app/actions/create-share";
import { ShareIcon } from "@/components/game/icons";
import { env } from "@/lib/env";

/**
 * - `idle` / `sharing`: normal flow.
 * - `copied`: the URL is on the clipboard.
 * - `create_failed`: the SERVER could not create/retrieve a share record —
 *   a real Rankle failure. No URL exists to fall back to.
 * - `copy_failed`: the server succeeded (a real URL exists) but every
 *   browser-level convenience (native share, clipboard) failed or was
 *   unavailable. This is never presented as a creation failure — see
 *   `url` below, which is preserved so the link stays usable manually.
 */
type Status = "idle" | "sharing" | "copied" | "create_failed" | "copy_failed";

/**
 * The "Share" CTA (Milestone 5; reliability fix — Share Button Reliability
 * milestone, docs/TODO.md). `navigator.share` (native share sheet) when
 * available, else copy-to-clipboard — no toast dependency (docs/DESIGN.md
 * sec 19, CLAUDE.md sec 4).
 *
 * CREATE / SHARE / COPY are kept as three distinct concerns: once `url` is
 * resolved from a successful `createShare` call, it is never discarded —
 * a later failure in `navigator.share` or `navigator.clipboard` (both
 * browser-level, both outside Rankle's control) can never be presented as
 * "Rankle couldn't create a share link," and the player always retains a
 * working way to get the real link (the manual field below). Cancelling the
 * native share sheet (`AbortError`) is a no-op, never an error.
 *
 * `create_share` is idempotent server-side; `url` is cached in state after
 * the first successful call so neither a retry tap nor a browser-API
 * failure ever re-hits the RPC.
 */
export function ShareButton({
  submissionId,
  gameTitle,
}: {
  submissionId: string;
  gameTitle: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const urlRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const copyInputRef = useRef<HTMLInputElement>(null);

  async function resolveUrl(): Promise<string | null> {
    if (urlRef.current) return urlRef.current;
    const result = await createShare({ submissionId });
    if (!result.ok) return null;
    const resolved = `${env.NEXT_PUBLIC_APP_URL}/share/${result.token}`;
    urlRef.current = resolved;
    setUrl(resolved);
    return resolved;
  }

  /** Try the clipboard; never throws. */
  async function tryCopy(text: string): Promise<boolean> {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function share() {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus("sharing");

    startTransition(async () => {
      const resolved = await resolveUrl();
      if (!resolved) {
        busyRef.current = false;
        setStatus("create_failed");
        return;
      }

      const text = `I ranked today's ${gameTitle}. Play yours to reveal mine.`;

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "Rankle", text, url: resolved });
          setStatus("idle");
          busyRef.current = false;
          return;
        } catch (err) {
          const cancelled = err instanceof Error && err.name === "AbortError";
          if (cancelled) {
            setStatus("idle");
            busyRef.current = false;
            return;
          }
          // A real (non-cancellation) native-share failure: fall back to
          // clipboard once, deterministically — never retry native share
          // again from here.
        }
      }

      setStatus((await tryCopy(resolved)) ? "copied" : "copy_failed");
      busyRef.current = false;
    });
  }

  async function retryCopy() {
    if (!url) return;
    setStatus((await tryCopy(url)) ? "copied" : "copy_failed");
  }

  // Select the fallback field's contents once it appears, so the link is
  // ready to copy with a single keyboard/mobile gesture — never before the
  // player has actually triggered a share attempt (this effect only runs
  // once `status` is already `copy_failed`).
  useEffect(() => {
    if (status === "copy_failed") copyInputRef.current?.select();
  }, [status]);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={share}
        aria-busy={status === "sharing"}
        disabled={status === "sharing"}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-display text-base font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
      >
        <ShareIcon className="size-4" />
        Share your ranking
      </button>
      <p role="status" aria-live="polite" className="text-center text-xs text-muted">
        {status === "copied"
          ? "Link copied"
          : status === "create_failed"
            ? "Couldn’t create a share link — try again."
            : ""}
      </p>
      {status === "copy_failed" && url ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted p-2.5">
          <p role="status" aria-live="polite" className="text-xs text-muted">
            Share link created, but we couldn’t copy it automatically. Copy it
            manually:
          </p>
          <div className="flex gap-1.5">
            <input
              ref={copyInputRef}
              type="text"
              readOnly
              value={url}
              aria-label="Share link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={retryCopy}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
