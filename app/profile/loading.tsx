import { SkeletonBlock, SkeletonHeader, SkeletonRow } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <div className="flex items-center gap-4" aria-hidden>
          <SkeletonBlock className="size-12 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <SkeletonBlock className="h-7 w-1/2" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        </div>
        <SkeletonBlock className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading profile…</span>
    </>
  );
}
