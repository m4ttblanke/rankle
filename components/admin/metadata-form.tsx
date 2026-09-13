"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateTierlist } from "@/app/actions/admin/update-tierlist";

const ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Check the title and slug.",
  taken: "That slug is already in use.",
  locked: "This Rankle already has official submissions and can no longer be edited.",
  network: "Couldn't save — try again.",
};

export function MetadataForm({
  id,
  title,
  prompt,
  slug,
}: {
  id: string;
  title: string;
  prompt: string | null;
  slug: string;
}) {
  const [titleValue, setTitleValue] = useState(title);
  const [promptValue, setPromptValue] = useState(prompt ?? "");
  const [slugValue, setSlugValue] = useState(slug);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    startTransition(async () => {
      const result = await updateTierlist({
        id,
        title: titleValue,
        prompt: promptValue.trim() || undefined,
        slug: slugValue,
      });
      if (result.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(ERROR_COPY[result.reason] ?? ERROR_COPY.network);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-semibold text-foreground">
          Title
        </label>
        <input
          id="title"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          required
          maxLength={200}
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-semibold text-foreground">
          Prompt <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="prompt"
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          maxLength={1000}
          rows={2}
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-semibold text-foreground">
          Slug
        </label>
        <input
          id="slug"
          value={slugValue}
          onChange={(e) => setSlugValue(e.target.value)}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          className="rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-md bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>
      <p role="status" aria-live="polite" className="text-xs text-muted">
        {status === "saved" ? "Saved" : status === "error" ? error : ""}
      </p>
    </form>
  );
}
