"use client";

import { useRef, useState, useTransition } from "react";
import { createShare } from "@/app/actions/create-share";
import { ShareIcon } from "@/components/game/icons";
import { env } from "@/lib/env";

type Status = "idle" | "sharing" | "copied" | "error";

/**
 * The "Share" CTA (Milestone 5) — used both on `/results` (share your own
 * ranking) and on the share reveal page (share it onward after playing).
 *
 * `navigator.share` (native share sheet) when available, else copy-to-
 * clipboard with an accessible "Link copied" live-region message — no toast
 * dependency (docs/DESIGN.md sec 19, CLAUDE.md sec 4). A user cancelling the
 * native share sheet (`AbortError`) is treated the same as never opening it,
 * never as an error.
 *
 * `create_share` is idempotent server-side, but the resolved token is cached
 * in a ref after the first successful call anyway, so a second tap (e.g. to
 * copy again after already sharing) doesn't re-hit the RPC.
 */
export function ShareButton({
  submissionId,
  gameTitle,
}: {
  submissionId: string;
  gameTitle: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  async function resolveToken(): Promise<string | null> {
    if (tokenRef.current) return tokenRef.current;
    const result = await createShare({ submissionId });
    if (!result.ok) return null;
    tokenRef.current = result.token;
    return result.token;
  }

  function share() {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus("sharing");

    startTransition(async () => {
      const token = await resolveToken();
      if (!token) {
        busyRef.current = false;
        setStatus("error");
        return;
      }

      const url = `${env.NEXT_PUBLIC_APP_URL}/share/${token}`;
      const text = `I ranked today's ${gameTitle}. Play yours to reveal mine.`;

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "Rankle", text, url });
          setStatus("idle");
        } catch (err) {
          const cancelled = err instanceof Error && err.name === "AbortError";
          setStatus(cancelled ? "idle" : "error");
        } finally {
          busyRef.current = false;
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } catch {
        setStatus("error");
      } finally {
        busyRef.current = false;
      }
    });
  }

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
          : status === "error"
            ? "Couldn’t create a share link — try again."
            : ""}
      </p>
    </div>
  );
}
