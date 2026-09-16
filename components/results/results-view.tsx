import {
  MIN_RESPONSES_FOR_VERDICT,
  communityTierList,
  hottestTake,
  isEarlyResults,
} from "@/lib/game/results";
import type { CountdownState } from "@/lib/game/countdown";
import type { FriendResultEntry } from "@/lib/game/get-friend-results";
import type { GameResults } from "@/lib/game/results-schema";
import type { StreakSummary } from "@/lib/game/streaks";
import { ShareButton } from "@/components/share/share-button";
import { CommunityTierList } from "./community-tier-list";
import { ComparisonList } from "./comparison-list";
import { FriendsComparison } from "./friends-comparison";
import { HottestTakeCard } from "./hottest-take-card";
import { ResultsHeading } from "./results-heading";
import { ReturnCue } from "./return-cue";

/**
 * The results reveal (Milestone 4). Server-rendered — the data is already
 * spoiler-gated and fetched by `app/results/page.tsx`; nothing here talks to
 * Supabase. Section order follows the approved M4 hierarchy: community
 * verdict -> your comparison -> hottest take/disagreement -> per-item detail
 * (folded inline into the comparison rows rather than a separate dashboard
 * section — docs/DESIGN.md sec 16, sec 17).
 */
export function ResultsView({
  results,
  friendResults,
  streak,
  countdown,
}: {
  results: GameResults;
  /** `null` for a signed-out visitor (guest or anonymous) -- the Friends
   *  section is account-only and is skipped entirely rather than shown
   *  empty. An empty array is the normal "no friends have played yet" state
   *  for a signed-in caller, and IS rendered. */
  friendResults: FriendResultEntry[] | null;
  /** `null` for a guest -- no streak claim is made for them. */
  streak: StreakSummary | null;
  countdown: CountdownState;
}) {
  const { tierlist, items, myRanking, totalSubmissions } = results;
  const early = isEarlyResults(results);
  const tierList = communityTierList(items, tierlist.tierConfig);
  const take = hottestTake(myRanking, items, tierlist.tierConfig);

  const meta = early
    ? totalSubmissions <= 1
      ? "Early results — you're one of the first to rank this one."
      : `Early results — only ${totalSubmissions} players so far.`
    : `${totalSubmissions} players have ranked today.`;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-5 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Results
        </span>
        <ResultsHeading>{tierlist.title}</ResultsHeading>
        <p className="text-sm text-muted" aria-live="off">
          {meta}
        </p>
      </div>

      <section aria-labelledby="community-heading" className="flex flex-col gap-3">
        <h2
          id="community-heading"
          className="font-display text-xl font-extrabold text-foreground"
        >
          Community verdict
        </h2>
        <CommunityTierList tierList={tierList} />
      </section>

      <section aria-labelledby="comparison-heading" className="flex flex-col gap-3">
        <h2
          id="comparison-heading"
          className="font-display text-xl font-extrabold text-foreground"
        >
          Your ranking vs. everyone else
        </h2>
        <ComparisonList
          myRanking={myRanking}
          items={items}
          tierConfig={tierlist.tierConfig}
          totalSubmissions={totalSubmissions}
        />
      </section>

      <section aria-labelledby="hottest-heading" className="flex flex-col gap-3">
        <h2
          id="hottest-heading"
          className="font-display text-xl font-extrabold text-foreground"
        >
          Your hottest take
        </h2>
        <HottestTakeCard take={take} />
        {totalSubmissions < MIN_RESPONSES_FOR_VERDICT ? (
          <p className="text-xs text-muted">
            Come back once more players have joined for a sharper read.
          </p>
        ) : null}
      </section>

      {friendResults !== null ? (
        <section aria-labelledby="friends-heading" className="flex flex-col gap-3">
          <h2
            id="friends-heading"
            className="font-display text-xl font-extrabold text-foreground"
          >
            Friends
          </h2>
          <FriendsComparison friends={friendResults} results={results} />
        </section>
      ) : null}

      <section aria-labelledby="share-heading" className="flex flex-col gap-3">
        <h2
          id="share-heading"
          className="font-display text-xl font-extrabold text-foreground"
        >
          Challenge a friend
        </h2>
        <p className="text-sm text-muted">
          Send today&rsquo;s {tierlist.title} — your ranking stays hidden
          until they play.
        </p>
        <ShareButton submissionId={results.submissionId} gameTitle={tierlist.title} />
      </section>

      <ReturnCue streak={streak} countdown={countdown} />
    </div>
  );
}
