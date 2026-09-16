import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Forward .env.local's public (NEXT_PUBLIC_*) vars to tests — used by the
// read-only Supabase RLS integration check. Missing file is fine (tests that
// need it skip themselves).
function publicEnvFromFile(file = ".env.local"): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// These five integration files all call submit_ranking() against whatever
// tierlist private.current_daily_game_id() currently resolves to — a
// single global "current game" row by construction (docs/SECURITY.md), not
// something submit_ranking() will let each file redirect to a fixture of
// its own. Running them as separate parallel files races on that shared
// row's aggregate counts (total_submissions etc.); giving each file an
// isolated fixture isn't possible without weakening that invariant, so
// this file set is deliberately serialized instead (fileParallelism below)
// rather than given fixture isolation. Everything else keeps full
// parallelism.
const SHARED_CURRENT_GAME_INTEGRATION_TESTS = [
  "lib/game/submit-ranking.integration.test.ts",
  "lib/game/get-results.integration.test.ts",
  "lib/game/get-share.integration.test.ts",
  "lib/game/claim-guest-submissions.integration.test.ts",
  "lib/game/friends.integration.test.ts",
];

export default defineConfig({
  test: {
    passWithNoTests: true,
    env: publicEnvFromFile(),
    projects: [
      {
        extends: true,
        resolve: {
          // Native Vite 8 resolution of the "@/*" paths from tsconfig.json.
          tsconfigPaths: true,
        },
        test: {
          name: "unit",
          // Default is Node. Component tests opt into jsdom with a
          // `// @vitest-environment jsdom` docblock.
          environment: "node",
          // Unit, component, and narrowly scoped read-only integration
          // tests. Playwright e2e specs live under e2e/ and run via
          // `npm run test:e2e`.
          include: [
            "lib/**/*.test.ts",
            "lib/**/*.spec.ts",
            "components/**/*.test.tsx",
            "app/**/*.test.ts",
          ],
          exclude: SHARED_CURRENT_GAME_INTEGRATION_TESTS,
        },
      },
      {
        extends: true,
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: "integration-shared-current-game",
          environment: "node",
          include: SHARED_CURRENT_GAME_INTEGRATION_TESTS,
          fileParallelism: false,
        },
      },
    ],
  },
});
