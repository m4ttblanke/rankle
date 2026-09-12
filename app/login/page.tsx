import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentUser } from "@/lib/auth/current-user";

type Props = { searchParams: Promise<{ error?: string }> };

/**
 * Sign-in (Milestone 6) — email magic link only, no password. Anonymous play
 * is never gated behind this route; it exists purely as an optional upgrade
 * (docs/MANUAL.md: "Save your Rankle history," never blocking the game).
 */
export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (user) redirect("/profile");

  const { error } = await searchParams;

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted">
            Save your Rankle history across devices.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-center text-sm text-foreground">
            That sign-in link didn’t work — request a new one below.
          </p>
        ) : null}
        <SignInForm />
      </div>
    </>
  );
}
