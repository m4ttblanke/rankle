import Link from "next/link";
import type { ShareTeaser } from "@/lib/game/share-schema";

/**
 * Pre-play spoiler gate (Milestone 5, docs/MANUAL.md sec 21) — shown when the
 * share's game is today's live game and this visitor has not yet submitted.
 * No placement, tier, or ranking data of the sender's is anywhere on this
 * page: only what `get_share`'s teaser already returns before eligibility.
 *
 * The CTA carries the (already server-validated) share token as a narrow
 * `?share=` query param into `/` — see `app/page.tsx` — so a successful or
 * duplicate submission can return the player straight to this reveal instead
 * of the ordinary `/results`.
 */
export function ShareGate({
  token,
  share,
}: {
  token: string;
  share: ShareTeaser;
}) {
  const senderName = share.senderDisplayName || share.senderUsername;
  const intro = senderName
    ? `${senderName} ranked today's ${share.tierlistTitle}.`
    : `Someone ranked today's ${share.tierlistTitle}.`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        Rankle
      </span>
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
        {intro}
      </h1>
      {share.tierlistPrompt ? (
        <p className="max-w-sm text-sm text-muted">{share.tierlistPrompt}</p>
      ) : null}
      <p className="font-display text-lg font-extrabold text-foreground">
        Think you agree?
      </p>
      <Link
        href={`/?share=${token}`}
        className="mt-2 w-full max-w-xs rounded-md bg-accent px-4 py-3 text-center font-display text-base font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Play today&rsquo;s Rankle
      </Link>
      <p className="text-xs text-muted">
        Finish your ranking to reveal {senderName ? `${senderName}’s` : "their"} list.
      </p>
    </div>
  );
}
