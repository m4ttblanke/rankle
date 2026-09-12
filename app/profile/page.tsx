import { redirect } from "next/navigation";
import { AvatarPlaceholder } from "@/components/profile/avatar";
import { HistoryList } from "@/components/profile/history-list";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getMyHistory } from "@/lib/game/history";

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * The signed-in user's own profile (Milestone 6) — requires sign-in
 * (redirects to `/login`); this is an account page, not part of the core
 * game loop, so gating it is fine (docs/MANUAL.md: never gate ranking,
 * submission, results, or sharing behind an account).
 *
 * Public profiles of OTHER users (`/profile/[username]`) are deliberately
 * out of scope for M6 — `profiles` has no anon read grant, and history stays
 * private to its owner; that is a privacy/product decision for a later,
 * explicitly social milestone (docs/SECURITY.md sec 6).
 */
export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const history = await getMyHistory();

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <header className="flex items-center gap-4">
          <AvatarPlaceholder name={profile.displayName} />
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {profile.displayName}
            </h1>
            <p className="text-sm text-muted">
              @{profile.username} · Joined {formatJoined(profile.createdAt)}
            </p>
          </div>
        </header>

        <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
          <h2 id="edit-heading" className="font-display text-xl font-extrabold text-foreground">
            Edit profile
          </h2>
          <ProfileEditForm username={profile.username} displayName={profile.displayName} />
        </section>

        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h2 id="history-heading" className="font-display text-xl font-extrabold text-foreground">
            Your Rankles ({history.length})
          </h2>
          <HistoryList entries={history} />
        </section>
      </div>
    </>
  );
}
