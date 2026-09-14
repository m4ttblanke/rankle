"use client";

import { RouteError } from "@/components/layout/route-error";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <RouteError message="Your results couldn’t load. This is usually temporary." reset={reset} />;
}
