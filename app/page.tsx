import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import {
  DemoControversy,
  DemoFriendComparison,
  DemoHottestTake,
} from "@/components/landing/demos";
import { HeroBoard } from "@/components/landing/hero-board";
import { PlayCta, type LandingState } from "@/components/landing/play-cta";
import { tierStyle } from "@/components/game/tier-style";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getArchive } from "@/lib/game/archive";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getFriendPlayedStatus } from "@/lib/game/friends";
import { getGuestId } from "@/lib/game/guest";
import { hasSubmittedRanking } from "@/lib/game/submission-state";

// Static on purpose: no topic, no counts, nothing identity-dependent, so
// nothing spoiler-adjacent can ever end up in a social preview or cache key.
export const metadata: Metadata = {
  title: "Rankle — Everyone has a ranking. What’s yours?",
  description:
    "A new tier list every day. Rank it, lock it in, then see what your friends and everyone else think.",
  openGraph: {
    title: "Rankle — Everyone has a ranking. What’s yours?",
    description:
      "A new tier list every day. Rank it, lock it in, then see what your friends and everyone else think.",
    siteName: "Rankle",
    type: "website",
  },
};

function weekday(dateOnly: string): string {
  // Local-midnight parse, same reasoning as `formatDateOnly`.
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

const SECTION = "mx-auto w-full max-w-5xl px-4 sm:px-6";
const EYEBROW = "font-display text-xs font-extrabold uppercase tracking-[0.18em] text-accent";
const H2 = "font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-foreground sm:text-5xl";

/**
 * `/` — the public landing page (replaces the old "`/` is the game" model;
 * today's game now lives at `/play`, see `app/play/page.tsx`).
 *
 * Spoiler boundary (docs/SECURITY.md sec 7): this page reads ONLY
 *  - `getDailyGame()` — title/prompt/item labels, the same pre-submission data
 *    `/play` already shows anyone;
 *  - `hasSubmittedRanking()` — a boolean about the caller's own submission,
 *    used solely to pick the CTA destination;
 *  - `getFriendPlayedStatus()` — reduced to a bare count here, exactly like
 *    `/play`'s "N friends played today" line; names/rankings never render;
 *  - `getArchive()` — public titles/dates of past Rankles.
 * No `get_results` / `get_share` / `get_friend_results` call happens on this
 * route, so no result data exists in its RSC payload or DOM to leak. Every
 * results/comparison visual below is hard-coded fiction (`demos.tsx`).
 *
 * Analytics: deliberately logs NO product event. `daily_game_viewed` means
 * "entered the ranking board" and fires only on `/play`; landing traffic is
 * already covered by Vercel Web Analytics page views (docs/MANUAL.md sec 30).
 *
 * Dynamic by construction (`getGuestId()` reads cookies), so the per-visitor
 * CTA state is never served from a shared cache.
 */
export default async function LandingPage() {
  const [game, user, guestId] = await Promise.all([
    getDailyGame(),
    getCurrentUser(),
    getGuestId(),
  ]);

  const [submitted, friendsPlayed, archive] = await Promise.all([
    game ? hasSubmittedRanking(game.id, guestId) : Promise.resolve(false),
    game && user
      ? getFriendPlayedStatus(game.id).then((rows) => rows.filter((f) => f.played).length)
      : Promise.resolve(0),
    getArchive(),
  ]);

  const state: LandingState = !game ? "none" : submitted ? "results" : "play";
  const pastRankles = archive.filter((e) => !e.isToday).slice(0, 5).reverse();
  const itemCount = game?.items.length ?? 0;

  return (
    <>
      <AppHeader wide />
      <main className="flex flex-1 flex-col overflow-x-clip">
        {/* 1 — HERO */}
        <section aria-labelledby="hero-heading" className={`${SECTION} grid items-center gap-6 pb-12 pt-8 sm:pt-14 md:grid-cols-[1.15fr_1fr] md:gap-10 md:pb-20`}>
          <div className="flex flex-col gap-6">
            <h1 id="hero-heading" className="font-display text-[clamp(2.6rem,8.5vw,4.4rem)] font-extrabold leading-[0.9] tracking-[-0.03em] text-foreground">
              Everyone has a ranking.{" "}
              <span className="block text-accent">What&rsquo;s yours?</span>
            </h1>
            <p className="max-w-md text-lg leading-snug text-foreground/80">
              A new tier list every day. Rank it, lock it in, then see what your
              friends and everyone else think.
            </p>

            {game ? (
              <div className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-surface p-4 shadow-[5px_5px_0_0_var(--ink)] sm:max-w-md">
                <div className="flex flex-col gap-1">
                  <p className={EYEBROW}>Today&rsquo;s Rankle</p>
                  <p className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
                    {game.title}
                  </p>
                  {submitted ? (
                    <p className="text-sm font-medium text-muted">You&rsquo;ve locked in today&rsquo;s ranking.</p>
                  ) : null}
                </div>
                <PlayCta state={state} className="w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-ink/40 bg-surface-muted p-4 sm:max-w-md">
                <p className="font-display text-2xl font-extrabold text-foreground">
                  Today&rsquo;s Rankle isn&rsquo;t up yet.
                </p>
                <p className="text-sm text-muted">A new list drops every day. Check back soon.</p>
                <PlayCta state="none" className="w-full" />
              </div>
            )}
          </div>

          <HeroBoard labels={game ? game.items.slice(0, 4).map((i) => i.label) : []} />
        </section>

        {/* 2 — TODAY'S RANKLE */}
        {game ? (
          <section aria-labelledby="today-heading" className="border-y-2 border-ink bg-brand-yellow">
            <div className={`${SECTION} flex flex-col gap-6 py-12 md:flex-row md:items-start md:justify-between md:gap-12 md:py-16`}>
              <div className="flex max-w-lg flex-col gap-3">
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-ink">
                  Today&rsquo;s Rankle
                </p>
                <h2 id="today-heading" className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-5xl">
                  {game.title}
                </h2>
                {game.prompt ? <p className="text-base text-ink/85">{game.prompt}</p> : null}
                <p className="font-display text-lg font-extrabold text-ink">
                  {itemCount} {itemCount === 1 ? "thing" : "things"} to rank. One shot.
                </p>
                {friendsPlayed > 0 ? (
                  <p className="text-sm font-semibold text-ink">
                    {friendsPlayed} of your friends played today
                  </p>
                ) : null}
                <PlayCta state={state} playLabel="Make Your Ranking" className="mt-2 self-start" />
              </div>
              <ul aria-label={`Items in ${game.title}`} className="flex max-w-md flex-wrap gap-2 md:justify-end">
                {game.items.map((item, i) => (
                  <li
                    key={item.id}
                    style={{ rotate: `${((i * 37) % 7) - 3}deg` }}
                    className="rounded-md border-2 border-ink bg-surface px-3 py-1.5 text-sm font-semibold text-ink"
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* 3 — HOW IT WORKS */}
        <section aria-labelledby="how-heading" className={`${SECTION} flex flex-col gap-10 py-16 md:py-24`}>
          <div className="flex flex-col gap-2">
            <p className={EYEBROW}>How it works</p>
            <h2 id="how-heading" className={H2}>Rank. Lock. Compare.</h2>
          </div>
          <ol className="flex flex-col gap-12">
            <li className="grid gap-4 md:grid-cols-[7rem_1fr_1.1fr] md:items-start">
              <span aria-hidden className="font-display text-6xl font-extrabold leading-none text-accent">01</span>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-extrabold text-foreground">Rank</h3>
                <p className="text-base text-muted">Put everything somewhere. Drag it, or tap it and pick a tier.</p>
              </div>
              <div className="flex flex-col gap-3">
                <ul aria-label="Tiers" className="flex flex-wrap gap-1.5">
                  {["S", "A", "B", "C", "F", "N/A"].map((tier) => (
                    <li
                      key={tier}
                      className={`grid h-11 min-w-11 place-items-center rounded-md border-2 border-ink px-2 font-display text-lg font-extrabold ${tierStyle(tier).chip.replace(/border-\S+/, "")}`}
                    >
                      {tier}
                    </li>
                  ))}
                </ul>
                <dl className="grid gap-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-bold text-foreground">N/A</dt>
                    <dd className="text-muted">Haven&rsquo;t tried it. That still counts as placed.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-bold text-foreground">Unranked</dt>
                    <dd className="text-muted">Not decided yet. You can&rsquo;t submit until it&rsquo;s empty.</dd>
                  </div>
                </dl>
              </div>
            </li>

            <li className="grid gap-4 md:grid-cols-[7rem_1fr_1.1fr] md:items-start">
              <span aria-hidden className="font-display text-6xl font-extrabold leading-none text-accent">02</span>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-extrabold text-foreground">Lock it in</h3>
                <p className="text-base text-muted">
                  Your ranking becomes official before you see what anyone else thinks.
                  One per day. No take-backs.
                </p>
              </div>
              <div aria-hidden className="flex items-center gap-3">
                <span className="inline-flex -rotate-2 items-center gap-2 rounded-md border-2 border-ink bg-accent px-5 py-3 font-display text-lg font-extrabold text-accent-foreground shadow-[4px_4px_0_0_var(--ink)]">
                  Lock it in
                </span>
                <span className="font-display text-sm font-extrabold uppercase tracking-widest text-muted">Official.</span>
              </div>
            </li>

            <li className="grid gap-4 md:grid-cols-[7rem_1fr_1.1fr] md:items-start">
              <span aria-hidden className="font-display text-6xl font-extrabold leading-none text-accent">03</span>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-extrabold text-foreground">Compare</h3>
                <p className="text-base text-muted">Then the results open up.</p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {["Community verdict", "Friend rankings", "Hottest take", "Most controversial"].map((label, i) => (
                  <li
                    key={label}
                    className={`rounded-md border-2 border-ink px-3 py-1.5 text-sm font-bold text-ink ${["bg-brand-pink", "bg-surface", "bg-brand-yellow", "bg-surface"][i]}`}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </li>
          </ol>
        </section>

        {/* 4 — RESULTS TEASER (demo data only) */}
        <section aria-labelledby="results-heading" className="border-y-2 border-ink bg-ink text-background">
          <div className={`${SECTION} flex flex-col gap-10 py-16 md:py-24`}>
            <div className="flex max-w-xl flex-col gap-3">
              <h2 id="results-heading" className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
                The fun starts after you submit.
              </h2>
              <p className="text-base text-background/80">
                Find out where you agree with everyone, and where you&rsquo;re on your own.
                Results stay hidden until your ranking is locked.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 md:gap-8">
              <DemoHottestTake />
              <DemoControversy />
            </div>
          </div>
        </section>

        {/* 5 — FRIENDS */}
        <section aria-labelledby="friends-heading" className={`${SECTION} grid gap-10 py-16 md:grid-cols-[1fr_1fr] md:items-center md:py-24`}>
          <div className="flex flex-col gap-4">
            <h2 id="friends-heading" className={H2}>
              Your friends have terrible taste.
            </h2>
            <p className="text-lg text-muted">Now you can prove it.</p>
            <ul className="flex flex-col gap-2 text-base text-foreground">
              {[
                "Add friends on Rankle",
                "See their ranking once you’ve both played",
                "Find your biggest disagreement",
                "Get an agreement score for every Rankle",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rotate-45 border-2 border-ink bg-brand-pink" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:-rotate-1">
            <DemoFriendComparison />
          </div>
        </section>

        {/* 6 — DAILY / ARCHIVE */}
        <section aria-labelledby="daily-heading" className="border-y-2 border-ink bg-brand-pink">
          <div className={`${SECTION} flex flex-col gap-8 py-16 md:py-20`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="daily-heading" className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-5xl">
                A new Rankle every day.
              </h2>
              <Link
                href="/archive"
                className="rounded-md text-base font-bold text-ink underline decoration-2 underline-offset-4 outline-none hover:decoration-4 focus-visible:ring-2 focus-visible:ring-ink"
              >
                Browse the archive →
              </Link>
            </div>
            {pastRankles.length > 0 || game ? (
              <ol aria-label="Recent Rankles" className="flex flex-wrap gap-3">
                {pastRankles.map((entry, i) => (
                  <li
                    key={entry.tierlistId}
                    style={{ rotate: `${i % 2 === 0 ? -2 : 1.5}deg` }}
                    className="flex min-w-[9rem] flex-col gap-1 rounded-lg border-2 border-ink bg-surface px-4 py-3 shadow-[3px_3px_0_0_var(--ink)]"
                  >
                    <span className="font-display text-xs font-extrabold uppercase tracking-widest text-muted">
                      {weekday(entry.releaseDate)}
                    </span>
                    <span className="font-display text-lg font-extrabold leading-tight text-ink">{entry.title}</span>
                  </li>
                ))}
                {game ? (
                  <li className="flex min-w-[9rem] flex-col gap-1 rounded-lg border-2 border-ink bg-brand-yellow px-4 py-3 shadow-[3px_3px_0_0_var(--ink)]">
                    <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink">
                      Today
                    </span>
                    <span className="font-display text-lg font-extrabold leading-tight text-ink">{game.title}</span>
                  </li>
                ) : null}
              </ol>
            ) : null}
          </div>
        </section>

        {/* 7 — ACCOUNT + FINAL CTA */}
        <section aria-labelledby="final-heading" className={`${SECTION} flex flex-col items-start gap-6 py-16 md:items-center md:py-24 md:text-center`}>
          <h2 id="final-heading" className={H2}>
            {state === "results" ? "See how you stacked up." : "Today’s list is waiting."}
          </h2>
          {!user ? (
            <div className="flex flex-col gap-2 md:items-center">
              <p className="font-display text-xl font-extrabold leading-snug text-foreground">
                Save your rankings. Find your friends. Build your history.
              </p>
              <p className="text-sm text-muted">
                No account needed to play.{" "}
                <Link
                  href="/login"
                  className="rounded-sm font-semibold text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Sign in
                </Link>{" "}
                to keep your history and streak.
              </p>
            </div>
          ) : null}
          <PlayCta state={state} />
        </section>
      </main>
    </>
  );
}
