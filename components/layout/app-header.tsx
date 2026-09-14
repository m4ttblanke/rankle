import Link from "next/link";
import { signOut } from "@/app/actions/sign-out";
import { getCurrentProfile } from "@/lib/auth/current-user";

/**
 * Shared app chrome (Milestone 6) — minimal by design (docs/MANUAL.md:
 * "Rankle should still feel like a game first," not a dashboard). Anonymous:
 * a single "Sign in" link. Authenticated: display name -> `/profile`, plus
 * "Sign out". Server Component — reads the current profile itself so every
 * page gets consistent chrome without threading auth state through props.
 */
export async function AppHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between gap-3 px-4 pt-5 sm:px-6 sm:pt-8">
      <Link
        href="/"
        className="flex items-center gap-1.5 font-display text-lg font-extrabold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static local
            SVG mark; next/image's optimizer refuses local SVGs without
            widening next.config.ts's dangerouslyAllowSVG allowance repo-wide. */}
        <img
          src="/brand/rankle-mark.svg"
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          className="shrink-0"
        />
        Rankle
      </Link>
      <nav className="flex items-center gap-3 text-xs">
        <Link
          href="/archive"
          className="font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          Archive
        </Link>
        {profile ? (
          <>
            <Link
              href="/friends"
              className="font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Friends
            </Link>
            <Link
              href="/profile"
              className="font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              {profile.displayName}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
