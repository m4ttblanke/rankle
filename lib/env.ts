import { z } from "zod";

/**
 * Validated, public environment. Every variable here is `NEXT_PUBLIC_*` and safe
 * to reference from browser code.
 *
 * Server-only secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`) are deliberately NOT
 * read here and are not imported anywhere in Milestone 1 — the read-only game
 * path uses the publishable key so Row Level Security still applies. When a
 * privileged server path is added, give it its own server-only module (never
 * `NEXT_PUBLIC_`, never imported by a Client Component) — see docs/SECURITY.md
 * sec 5.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

// Reference each var statically so Next.js can inline it into the client bundle.
const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => ` - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid or missing environment variables:\n${details}\n` +
      "Copy .env.example to .env.local and fill in the values.",
  );
}

export const env = parsed.data;
