import Link from "next/link";
import { createTierlistAndRedirect } from "@/app/actions/admin/create-tierlist";
import { requireAdmin } from "@/lib/admin/require-admin";

const ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Check the slug and title.",
  taken: "That slug is already in use.",
  network: "Couldn't create — try again.",
};

/**
 * Create a new draft (Milestone 8). A plain `<form action={...}>` — no
 * client-side state needed for a single create-then-redirect step
 * (docs/CLAUDE.md sec 9: default to Server Components / native form actions
 * when client-side behavior isn't required). Always lands as a draft on the
 * canonical S/A/B/C/F/N/A scale (Decision 5) — no tier-config UI here.
 */
export default async function NewTierlistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-xs text-muted underline-offset-2 hover:underline">
          ← All Rankles
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">New Rankle</h1>
        <p className="text-sm text-muted">Add items and schedule it once the draft is created.</p>
      </div>

      <form action={createTierlistAndRedirect} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-semibold text-foreground">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            placeholder="Fast Food Fries"
            className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-sm font-semibold text-foreground">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="fast-food-fries"
            className="rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prompt" className="text-sm font-semibold text-foreground">
            Prompt <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="prompt"
            name="prompt"
            maxLength={1000}
            rows={2}
            placeholder="Rank the fries. No fence-sitting."
            className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-md bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Create draft
        </button>
        {error ? (
          <p role="alert" className="text-xs font-semibold text-muted">
            {ERROR_COPY[error] ?? ERROR_COPY.network}
          </p>
        ) : null}
      </form>
    </div>
  );
}
