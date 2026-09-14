/** The static wordmark shown in place of the real (async) `AppHeader` while
 *  a route's data is still loading — matches the pre-existing root
 *  `app/loading.tsx` header exactly. */
export function SkeletonHeader() {
  return (
    <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between px-4 pt-5 sm:px-6 sm:pt-8">
      <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
        Rankle
      </span>
    </header>
  );
}

/**
 * Shared loading-skeleton primitives (Milestone 9) — every route's
 * `loading.tsx` composes these two shapes rather than repeating raw
 * `bg-surface-muted` markup eight times. Deliberately static (no pulse
 * animation): docs/DESIGN.md sec 25 says not to overanimate skeletons, and
 * the pre-existing root skeleton (`app/loading.tsx`) already set that
 * precedent.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-surface-muted ${className}`} />;
}

/** A list-row-shaped placeholder, matching the height of a real card/row
 *  (history/friends/archive entries, etc.) so content doesn't jump on load. */
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-16 rounded-lg border border-border bg-surface-muted ${className}`}
    />
  );
}
