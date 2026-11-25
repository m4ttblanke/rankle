/**
 * Lightweight skeleton for the daily game screen. Preserves the shell and
 * approximate dimensions to minimise layout shift (docs/DESIGN.md sec 25).
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Rankle
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-5" aria-hidden>
        <div className="h-9 w-2/3 rounded-md bg-surface-muted" />
        <div className="h-24 rounded-xl border border-border bg-surface-muted" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-border bg-surface-muted"
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading today&rsquo;s game…</span>
    </div>
  );
}
