"use client";

import { useState, useTransition, type FormEvent } from "react";
import { signInWithMagicLink } from "@/app/actions/sign-in";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Email magic-link sign-in (Milestone 6) — no password field, matching the
 * chosen Supabase Auth flow. Announces both the "check your email" success
 * state and validation errors via an associated, accessible message.
 */
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    startTransition(async () => {
      const result = await signInWithMagicLink({ email });
      setStatus(result.ok ? "sent" : "error");
    });
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-surface p-4 text-center"
      >
        <p className="font-display text-lg font-extrabold text-foreground">
          Check your email
        </p>
        <p className="mt-1 text-sm text-muted">
          We sent a sign-in link to {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "email-error" : undefined}
          className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {status === "error" ? (
          <p id="email-error" role="alert" className="text-sm text-foreground">
            Couldn’t send the link — check the address and try again.
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-md bg-accent px-4 py-3 font-display text-base font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
      >
        {status === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
