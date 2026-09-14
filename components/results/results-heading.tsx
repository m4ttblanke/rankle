import { FocusHeading } from "@/components/layout/focus-heading";

/**
 * The results page's `<h1>`, focused on mount — see `FocusHeading` for why
 * (this is a client-side navigation, `router.replace("/results")` after
 * submit, or a plain link).
 */
export function ResultsHeading({ children }: { children: React.ReactNode }) {
  return (
    <FocusHeading className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
      {children}
    </FocusHeading>
  );
}
