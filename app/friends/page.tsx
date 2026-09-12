import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { FriendSearch } from "@/components/friends/friend-search";
import { FriendsList } from "@/components/friends/friends-list";
import { IncomingRequests } from "@/components/friends/incoming-requests";
import { OutgoingRequests } from "@/components/friends/outgoing-requests";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getDailyGame } from "@/lib/game/get-daily-game";
import { getFriendPlayedStatus, listFriendRequests, listFriends } from "@/lib/game/friends";

/**
 * Friend discovery + management (Milestone 7) — account-only, mirroring
 * `/profile`'s "requires sign-in, gate here rather than the core game loop"
 * pattern (docs/MANUAL.md: never gate ranking/submission/results/sharing
 * behind an account; friend features are the exception, by design).
 *
 * Compact by design (docs/DESIGN.md): search, incoming, outgoing, friends —
 * no follower counts, no activity feed, no infinite lists.
 */
export default async function FriendsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [friends, requests, game] = await Promise.all([
    listFriends(),
    listFriendRequests(),
    getDailyGame(),
  ]);

  const playedByUserId = game
    ? new Map((await getFriendPlayedStatus(game.id)).map((p) => [p.userId, p.played]))
    : null;

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Friends
          </h1>
          <p className="text-sm text-muted">Compare Rankle opinions with people you know.</p>
        </header>

        <section aria-labelledby="search-heading" className="flex flex-col gap-3">
          <h2 id="search-heading" className="font-display text-xl font-extrabold text-foreground">
            Find a friend
          </h2>
          <FriendSearch />
        </section>

        {requests.incoming.length > 0 ? (
          <section aria-labelledby="incoming-heading" className="flex flex-col gap-3">
            <h2 id="incoming-heading" className="font-display text-xl font-extrabold text-foreground">
              Requests ({requests.incoming.length})
            </h2>
            <IncomingRequests requests={requests.incoming} />
          </section>
        ) : null}

        {requests.outgoing.length > 0 ? (
          <section aria-labelledby="outgoing-heading" className="flex flex-col gap-3">
            <h2 id="outgoing-heading" className="font-display text-xl font-extrabold text-foreground">
              Pending
            </h2>
            <OutgoingRequests requests={requests.outgoing} />
          </section>
        ) : null}

        <section aria-labelledby="friends-heading" className="flex flex-col gap-3">
          <h2 id="friends-heading" className="font-display text-xl font-extrabold text-foreground">
            Your friends ({friends.length})
          </h2>
          <FriendsList friends={friends} playedByUserId={playedByUserId} />
        </section>
      </div>
    </>
  );
}
