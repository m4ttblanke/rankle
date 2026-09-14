import { SkeletonBlock } from "@/components/layout/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
      <div aria-hidden className="flex flex-col gap-6">
        <SkeletonBlock className="h-8 w-1/2" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-11 w-full" />
        ))}
      </div>
      <span className="sr-only">Loading new Rankle form…</span>
    </div>
  );
}
