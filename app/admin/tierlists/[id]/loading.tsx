import { SkeletonBlock, SkeletonRow } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-10 pt-6 sm:px-6">
      <div aria-hidden className="flex flex-col gap-8">
        <SkeletonBlock className="h-8 w-1/2" />
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-5 w-1/4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-11 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-5 w-1/4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading Rankle editor…</span>
    </div>
  );
}
