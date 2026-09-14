import { SkeletonBlock, SkeletonHeader } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-2" aria-hidden>
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-9 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3" aria-hidden>
            <SkeletonBlock className="h-6 w-1/2" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading results…</span>
    </>
  );
}
