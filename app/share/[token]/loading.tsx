import { SkeletonBlock, SkeletonHeader } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-12 sm:px-6"
        aria-hidden
      >
        <SkeletonBlock className="h-9 w-3/4" />
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-12 w-full max-w-xs" />
      </div>
      <span className="sr-only">Loading share…</span>
    </>
  );
}
