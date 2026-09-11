import type { Metadata } from "next";
import { InvalidShare } from "@/components/share/invalid-share";
import { ShareGate } from "@/components/share/share-gate";
import { ShareReveal } from "@/components/share/share-reveal";
import { ShareWrappedUp } from "@/components/share/share-wrapped-up";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getGuestId } from "@/lib/game/guest";
import { getResults } from "@/lib/game/get-results";
import { getShare, getTierlistIdBySlug } from "@/lib/game/get-share";

type Params = { params: Promise<{ token: string }> };

/**
 * Spoiler-safe social preview (Milestone 5). Reads ONLY `get_share`'s teaser
 * fields (title/prompt/sender name) — never `locked` or `ranking`. This is a
 * second, independent `get_share` call from the page body's own; both are
 * cheap teaser-only reads, and duplicating the call avoids threading data
 * through a shared cache that could otherwise blur the "metadata is always
 * spoiler-free" boundary with the page's own identity-aware fetch
 * (docs/SECURITY.md sec 7, sec 8).
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const share = await getShare(token, null);

  if (!share) {
    return {
      title: "Rankle",
      description: "A daily social tier-list game.",
    };
  }

  const senderName = share.senderDisplayName || share.senderUsername;
  const title = senderName
    ? `${senderName} ranked ${share.tierlistTitle} — Rankle`
    : `${share.tierlistTitle} — Rankle`;

  return {
    title,
    description: "Play today's Rankle to reveal their ranking.",
  };
}

/**
 * The share reveal route (Milestone 5, docs/MANUAL.md sec 21, sec 26).
 *
 * Identity-aware and never statically or publicly cached: `getGuestId()`
 * reads the request's `cookies()`, which is one of Next's "Dynamic APIs" —
 * using it opts this whole route out of the Full Route Cache / static
 * rendering automatically (same mechanism `app/results/page.tsx` already
 * relies on), so there is no shared-cache path where one visitor's unlocked
 * response could be served to another (docs/SECURITY.md's caching
 * requirement for this route).
 *
 * Branches, in order:
 *  1. Invalid/unknown/revoked token -> generic `InvalidShare`.
 *  2. Locked (not yet eligible) + share's game is today's live game ->
 *     `ShareGate` (spoiler-free invitation).
 *  3. Locked + share's game is NOT today's live game -> `ShareWrappedUp`
 *     (the game rotated before this visitor opened the link — no archive
 *     gameplay in M5, so this never pretends they can still play it).
 *  4. Unlocked (this identity is eligible) -> `ShareReveal`, which needs the
 *     recipient's OWN results for the same game (`get_results`, via the
 *     represented tierlist's id, resolved from its slug — `get_share`'s
 *     teaser never exposes ids, only the slug).
 */
export default async function SharePage({ params }: Params) {
  const { token } = await params;
  const guestId = await getGuestId();
  const share = await getShare(token, guestId);

  if (!share) return <InvalidShare />;

  const todayGame = await getDailyGame();
  const isCurrentGame = todayGame?.slug === share.tierlistSlug;

  if (share.locked) {
    return isCurrentGame ? (
      <ShareGate token={token} share={share} />
    ) : (
      <ShareWrappedUp share={share} />
    );
  }

  const tierlistId = await getTierlistIdBySlug(share.tierlistSlug);
  const myResults = tierlistId ? await getResults(tierlistId, guestId) : null;

  // Defensive: `locked: false` means this identity is eligible, which means
  // it has its own submission for this tierlist, so `getResults` should
  // always succeed here. Falling back to "wrapped up" rather than crashing
  // if that invariant is ever violated (e.g. the game was disabled between
  // eligibility check and this read).
  if (!myResults) return <ShareWrappedUp share={share} />;

  return <ShareReveal share={share} myResults={myResults} />;
}
