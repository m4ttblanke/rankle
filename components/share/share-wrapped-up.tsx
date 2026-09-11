import Link from "next/link";
import type { ShareTeaser } from "@/lib/game/share-schema";

/**
 * Shown when a valid, still-locked share points at a game that is no longer
 * today's live game (it rotated before this visitor opened the link). There
 * is no archive-gameplay route to send them into to unlock it (that is
 * Milestone 9's scope, not this one) — so this state must NOT pretend they
 * can still play the represented game, and its CTA must be clearly a
 * *different* action ("today's Rankle"), never framed as continuing this
 * share (docs/MANUAL.md sec 21, sec 25).
 */
export function ShareWrappedUp({ share }: { share: ShareTeaser }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        This Rankle has already wrapped up
      </h1>
      <p className="max-w-xs text-sm text-muted">
        {share.tierlistTitle} isn&rsquo;t today&rsquo;s game anymore, so there&rsquo;s
        no way to unlock this ranking now.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Play today&rsquo;s Rankle instead
      </Link>
    </div>
  );
}
