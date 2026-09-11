/**
 * Post-submission state (Milestone 3). Deliberately restrained: it marks the
 * "lock it in" moment and points at what comes next. No board, no community
 * results, no friend data, no confetti — the reveal is Milestone 4
 * (docs/DESIGN.md sec 15, sec 16). Replacing the board outright also makes it
 * structurally impossible to mutate the official ranking after success.
 */
export function SubmittedPanel({
  variant = "locked",
}: {
  /** "locked" just after submitting this session; "already" when recognised on
   *  load or when a duplicate submit was detected. */
  variant?: "locked" | "already";
}) {
  const heading =
    variant === "already" ? "You're locked in" : "Ranking locked in";

  return (
    <section
      aria-labelledby="submitted-heading"
      className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-12 text-center"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full bg-tier-c/[0.12] font-display text-xl font-extrabold text-tier-c"
      >
        ✓
      </span>
      <h1
        id="submitted-heading"
        tabIndex={-1}
        className="rounded-md font-display text-3xl font-extrabold tracking-tight text-foreground outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
      >
        {heading}
      </h1>
      <p className="max-w-xs text-sm text-muted">
        Your ranking is final — it can&rsquo;t be changed. Results open next.
      </p>
    </section>
  );
}
