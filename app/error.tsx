"use client";

import { RouteError } from "@/components/layout/route-error";

/**
 * Root error boundary — the fallback for every route that does NOT define
 * its own more specific `error.tsx` (Milestone 9 added dedicated ones for
 * `/results`, `/share/[token]`, `/profile`, `/history/[submissionId]`,
 * `/friends`, `/archive`, and the admin routes). Copy here must stay
 * route-agnostic: this used to say "Today's game couldn't load," which was
 * simply wrong whenever it fired on an unrelated route.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <RouteError message="This page couldn’t load. This is usually temporary." reset={reset} />;
}
