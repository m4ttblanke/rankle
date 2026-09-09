import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="max-w-xs text-sm text-muted">
        That page doesn&rsquo;t exist.
      </p>
      <Link
        href="/"
        className="mt-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        Go to today&rsquo;s game
      </Link>
    </div>
  );
}
