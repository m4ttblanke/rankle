import { readFileSync } from "node:fs";

/**
 * Tiny `.env.test` loader shared by the local-Supabase-only integration test
 * files (Milestone 3). Deliberately independent of `vitest.config.mts`'s
 * `NEXT_PUBLIC_*` forwarding (which feeds the read-only *remote* integration
 * tests from `.env.local`) — a test file that only imports this can never pick
 * up remote/production configuration by accident.
 */
export function loadEnvTest(file = ".env.test"): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * Hard guard: throws (does not skip) when `url` is anything but a loopback
 * address, so a misconfigured `.env.test` can never point a local-only test
 * suite at a remote project. Loud on purpose.
 */
export function assertLoopbackUrl(url: string): void {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
    throw new Error(
      `Refusing to run local-only Supabase tests against a non-local URL: ${url}. ` +
        "Point .env.test at a local `supabase start` stack only.",
    );
  }
}
