"use client";

import { useEffect, useRef } from "react";

/**
 * A page `<h1>` that moves focus to itself on mount — for any route reached
 * via a client-side `router.replace`/`push` (not a full page load), where
 * the App Router does not reset focus on its own. Originally introduced as
 * `ResultsHeading` (Milestone 4); generalized here once the same need
 * showed up on the share-page states, `/login`, and `/profile` too
 * (docs/TODO.md's repeated "heading focus not moved" follow-up note).
 */
export function FocusHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className={`rounded-md outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${className}`}
    >
      {children}
    </h1>
  );
}
