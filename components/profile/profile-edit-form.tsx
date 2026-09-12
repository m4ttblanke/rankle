"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/update-profile";

type Status = "idle" | "saving" | "saved" | "error";

const ERROR_COPY: Record<string, string> = {
  taken: "That username is already taken.",
  invalid: "Username must be 3-20 lowercase letters, numbers, or underscores.",
  unauthenticated: "Your session expired — sign in again.",
  network: "Couldn’t save — try again.",
};

/**
 * Edit username/display name (Milestone 6). Reuses the database's own
 * constraints as the client-side hint (`pattern`/`minLength`/`maxLength`) —
 * `updateProfile` (`app/actions/update-profile.ts`) remains the actual
 * authority.
 */
export function ProfileEditForm({
  username,
  displayName,
}: {
  username: string;
  displayName: string;
}) {
  const [usernameValue, setUsernameValue] = useState(username);
  const [displayNameValue, setDisplayNameValue] = useState(displayName);
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    startTransition(async () => {
      const result = await updateProfile({
        username: usernameValue,
        displayName: displayNameValue,
      });
      if (result.ok) {
        setStatus("saved");
        setErrorReason(null);
      } else {
        setStatus("error");
        setErrorReason(ERROR_COPY[result.reason] ?? ERROR_COPY.network);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-semibold text-foreground">
          Username
        </label>
        <input
          id="username"
          name="username"
          value={usernameValue}
          onChange={(e) => setUsernameValue(e.target.value)}
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]+"
          required
          aria-invalid={status === "error"}
          aria-describedby="profile-feedback"
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-semibold text-foreground">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          value={displayNameValue}
          onChange={(e) => setDisplayNameValue(e.target.value)}
          minLength={1}
          maxLength={50}
          required
          aria-invalid={status === "error"}
          aria-describedby="profile-feedback"
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-md bg-accent px-4 py-2.5 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>
      <p id="profile-feedback" role="status" aria-live="polite" className="text-xs text-muted">
        {status === "saved" ? "Saved" : status === "error" ? errorReason : ""}
      </p>
    </form>
  );
}
