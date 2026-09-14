import { SkeletonBlock, SkeletonHeader, SkeletonRow } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <div className="flex flex-col gap-1.5" aria-hidden>
          <SkeletonBlock className="h-8 w-1/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading archive…</span>
    </>
  );
}
