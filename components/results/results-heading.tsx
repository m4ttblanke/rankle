"use client";

import { useEffect, useRef } from "react";

/**
 * The results page's `<h1>`, focused on mount. This is a client-side
 * navigation (`router.replace("/results")` after submit, or a plain link) —
 * unlike a full browser reload, the App Router does not reset focus on its
 * own, so screen reader / keyboard users need an explicit move here (same
 * pattern the M3 submitted panel used for its heading).
 */
export function ResultsHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className="rounded-md font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background sm:text-4xl"
    >
      {children}
    </h1>
  );
}
