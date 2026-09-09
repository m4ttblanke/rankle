/**
 * Shown when no daily game is currently live (docs/DESIGN.md sec 26).
 * Explains what's missing and what to do next, in short copy.
 */
export function NoGameToday() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        No game today
      </h1>
      <p className="max-w-xs text-sm text-muted">
        Today&rsquo;s Rankle isn&rsquo;t up yet. Check back soon — a new list
        drops every day.
      </p>
    </div>
  );
}
