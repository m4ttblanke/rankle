import { ArchiveList } from "@/components/archive/archive-list";
import { AppHeader } from "@/components/layout/app-header";
import { getArchive } from "@/lib/game/archive";

/**
 * Past-Rankles browse (Milestone 9) — read-only, open to everyone including
 * signed-out visitors (docs/MANUAL.md sec 25: "anyone can browse prior
 * topics"). Never a submission path to an old game (docs/SECURITY.md sec 13
 * / M8's `current_daily_game_id()`-only gate is untouched by this route).
 */
export default async function ArchivePage() {
  const entries = await getArchive();

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Archive
          </h1>
          <p className="text-sm text-muted">Every Rankle so far.</p>
        </div>

        <section aria-label="Past Rankles">
          <ArchiveList entries={entries} />
        </section>
      </div>
    </>
  );
}
