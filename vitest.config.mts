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

export default defineConfig({
  resolve: {
    // Native Vite 8 resolution of the "@/*" paths from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    // Default is Node. Component tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
    // Unit, component, and narrowly scoped read-only integration tests.
    // Playwright e2e specs live under e2e/ and run via `npm run test:e2e`.
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.spec.ts",
      "components/**/*.test.tsx",
    ],
    passWithNoTests: true,
    env: publicEnvFromFile(),
  },
});
