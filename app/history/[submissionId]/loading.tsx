import { SkeletonBlock, SkeletonHeader } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-5 pt-6 sm:px-6 sm:pb-8">
        <div className="flex flex-col gap-1.5" aria-hidden>
          <SkeletonBlock className="h-8 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading Rankle…</span>
    </>
  );
}
