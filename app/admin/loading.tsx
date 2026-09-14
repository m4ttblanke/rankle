import { SkeletonBlock, SkeletonRow } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-10 pt-6 sm:px-6">
      <div aria-hidden className="flex flex-col gap-8">
        <SkeletonBlock className="h-8 w-1/3" />
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="flex flex-col gap-3">
            <SkeletonBlock className="h-5 w-1/4" />
            {Array.from({ length: 2 }).map((_, row) => (
              <SkeletonRow key={row} />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading admin dashboard…</span>
    </div>
  );
}
