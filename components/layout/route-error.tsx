"use client";

/**
 * Shared shell for every route's `error.tsx` (Milestone 9) — plain language,
 * a recovery action, no implementation detail (docs/DESIGN.md sec 27,
 * docs/SECURITY.md sec 22). Extracted once nine near-identical
 * route-specific boundaries existed; only `message` (and, for the wider
 * admin routes, `maxWidth`) actually varies between them.
 */
export function RouteError({
  message,
  reset,
  maxWidth = "max-w-2xl",
}: {
  message: string;
  reset: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className={`mx-auto flex w-full ${maxWidth} flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center`}
    >
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-xs text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        Try again
      </button>
    </div>
  );
}
