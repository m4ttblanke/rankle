"use client";

/**
 * Route error boundary for the daily game screen. Plain language, a recovery
 * action, no implementation detail (docs/DESIGN.md sec 27, docs/SECURITY.md
 * sec 22).
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-xs text-sm text-muted">
        Today&rsquo;s game couldn&rsquo;t load. This is usually temporary.
      </p>
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
