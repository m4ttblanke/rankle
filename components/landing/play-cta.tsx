import Link from "next/link";

/**
 * Where the landing page's primary action should send this visitor
 * (docs/MANUAL.md sec 26). Decided server-side in `app/page.tsx` from the
 * boolean-only `has_submitted_ranking` RPC — never from result data.
 *
 *  - `play`    -> `/play` (no official submission yet today)
 *  - `results` -> `/results` (already submitted; never routed back through
 *                 `/play`, which would only bounce them anyway)
 *  - `none`    -> no live game; the archive is the only honest destination
 */
export type LandingState = "play" | "results" | "none";

const COPY: Record<LandingState, { href: string; label: string }> = {
  play: { href: "/play", label: "Play Today’s Rankle" },
  results: { href: "/results", label: "See Today’s Results" },
  none: { href: "/archive", label: "Browse Past Rankles" },
};

export function PlayCta({
  state,
  playLabel,
  className = "",
}: {
  state: LandingState;
  /** Optional override for the `play` state's label only. */
  playLabel?: string;
  className?: string;
}) {
  const { href, label } = COPY[state];
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-ink bg-accent px-6 py-3 text-center font-display text-lg font-extrabold text-accent-foreground shadow-[4px_4px_0_0_var(--ink)] outline-none transition-transform hover:-translate-y-0.5 hover:shadow-[5px_6px_0_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_var(--ink)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background ${className}`}
    >
      {state === "play" && playLabel ? playLabel : label}
      <span aria-hidden>→</span>
    </Link>
  );
}
