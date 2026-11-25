import { SkeletonBlock } from "@/components/layout/skeleton";

/**
 * Root loading fallback — shapes the landing page's hero (the game's own
 * skeleton moved with it to `app/play/loading.tsx`). The wordmark is a plain
 * `<div>`, not a `<header>`, so this fallback never adds a second banner
 * landmark next to the real `AppHeader` (docs/TODO.md's skeleton note).
 */
export default function Loading() {
  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl items-baseline px-4 pt-5 sm:px-6 sm:pt-8">
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Rankle
        </span>
      </div>
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 pt-8 sm:px-6 sm:pt-14 md:grid-cols-[1.15fr_1fr]" aria-hidden>
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-14 w-11/12" />
          <SkeletonBlock className="h-14 w-2/3" />
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="mt-2 h-40 w-full max-w-md rounded-xl" />
        </div>
        <SkeletonBlock className="h-72 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading Rankle…</span>
    </>
  );
}
