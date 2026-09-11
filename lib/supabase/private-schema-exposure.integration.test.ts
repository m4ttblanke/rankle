import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "./types";

/**
 * Verifies the security boundary that `supabase/tests/rls_spec.sql` sec 1
 * relies on: `private.is_admin()` / `private.has_submitted()` are
 * EXECUTE-granted to `anon`/`authenticated` at the SQL level (migration 1/2) —
 * required so RLS policies that call them can even evaluate — but that grant
 * must never translate into an HTTP-reachable endpoint. PostgREST only serves
 * functions from its configured exposed schema(s) (`public` here); `private`
 * is never listed. Calling either helper by name through the normal
 * anon/publishable client must therefore fail as "function not found", not
 * "found but unauthorized" — a 42501 there would mean the grant is doing
 * nothing useful; a 200 would mean the private schema leaked onto the API.
 *
 * Runs ONLY against the isolated LOCAL Supabase stack (`.env.test`; see
 * `lib/test-support/local-env.ts`), using the plain publishable key — never
 * the service role, and without touching PostgREST's exposed-schema config.
 * Asserts on PostgREST's stable structured `error.code` / HTTP `status`
 * rather than matching message text, so it can't pass by accident on
 * unrelated wording.
 *
 * If either helper turns out to be reachable, that is a real security
 * regression in the exposed-schema boundary — this test must fail loudly, not
 * be adjusted to pass.
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !key)(
  "private.* helpers are not exposed as PostgREST RPC endpoints (local Supabase)",
  () => {
    if (url) assertLoopbackUrl(url);

    const supabase = createClient<Database>(url!, key!);

    it("is_admin is not callable as a public RPC", async () => {
      const { data, error, status } = await supabase.rpc(
        "is_admin" as never,
      );
      expect(status).toBe(404);
      expect(error?.code).toBe("PGRST202");
      expect(data).toBeNull();
    });

    it("has_submitted is not callable as a public RPC", async () => {
      const { data, error, status } = await supabase.rpc("has_submitted" as never, {
        p_tierlist_id: "11111111-1111-1111-1111-111111111111",
      } as never);
      expect(status).toBe(404);
      expect(error?.code).toBe("PGRST202");
      expect(data).toBeNull();
    });

    // Control: proves the 404s above mean "not exposed", not "local stack is
    // broken" — a genuinely public RPC on the same project still works.
    it("control: a genuinely public RPC (has_submitted_ranking) still works", async () => {
      const { data, error, status } = await supabase.rpc("has_submitted_ranking", {
        p_tierlist_id: "11111111-1111-1111-1111-111111111111",
      });
      expect(status).toBe(200);
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  },
);
