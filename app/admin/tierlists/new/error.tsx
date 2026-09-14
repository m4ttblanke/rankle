"use client";

import { RouteError } from "@/components/layout/route-error";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <RouteError
      message="The new Rankle form couldn’t load. This is usually temporary."
      reset={reset}
      maxWidth="max-w-xl"
    />
  );
}
