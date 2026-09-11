import Link from "next/link";

/**
 * Shown for a malformed token, an unknown token, or a revoked share
 * (docs/MANUAL.md sec 21) — deliberately one generic message for all three,
 * so nothing distinguishes "this token never existed" from "this share was
 * revoked" to a visitor (docs/SECURITY.md sec 8, sec 9).
 */
export function InvalidShare() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        This link doesn&rsquo;t work
      </h1>
      <p className="max-w-xs text-sm text-muted">
        It may be mistyped, expired, or no longer available.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Play today&rsquo;s Rankle
      </Link>
    </div>
  );
}
