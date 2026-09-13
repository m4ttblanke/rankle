"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTierlist } from "@/app/actions/admin/delete-tierlist";
import { duplicateTierlist } from "@/app/actions/admin/duplicate-tierlist";

const DUPLICATE_ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Enter a valid slug for the copy.",
  taken: "That slug is already in use.",
  not_found: "This Rankle no longer exists.",
  network: "Couldn't duplicate — try again.",
};

const DELETE_ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Something went wrong.",
  locked: "This Rankle already has official submissions and can't be deleted.",
  network: "Couldn't delete — try again.",
};

export function DangerZone({
  id,
  slug,
  canDelete,
}: {
  id: string;
  slug: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [newSlug, setNewSlug] = useState(`${slug}-copy`);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function duplicate() {
    setDuplicating(true);
    startTransition(async () => {
      const result = await duplicateTierlist({ id, newSlug });
      setDuplicating(false);
      if (result.ok) {
        router.push(`/admin/tierlists/${result.id}`);
      } else {
        setDuplicateError(DUPLICATE_ERROR_COPY[result.reason] ?? DUPLICATE_ERROR_COPY.network);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTierlist({ id });
      if (result.ok) {
        router.push("/admin");
      } else {
        setDeleteError(DELETE_ERROR_COPY[result.reason] ?? DELETE_ERROR_COPY.network);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Duplicate</p>
        <p className="text-xs text-muted">Creates a new draft with a fresh copy of this title, prompt, and items.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">New slug</span>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <button
            type="button"
            onClick={duplicate}
            disabled={duplicating}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70"
          >
            {duplicating ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted">
          {duplicateError ?? ""}
        </p>
      </div>

      {canDelete ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">Delete draft</p>
          <p className="text-xs text-muted">Only possible while this Rankle has zero official submissions.</p>
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Delete this draft permanently?</span>
              <button
                type="button"
                onClick={remove}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-muted underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="self-start text-xs text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Delete this draft
            </button>
          )}
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {deleteError ?? ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
