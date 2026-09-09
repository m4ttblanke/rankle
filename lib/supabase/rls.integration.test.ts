import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "./types";

/*
 * Read-only integration check against the remote Supabase project, from the
 * app's own publishable key. Verifies the trust boundaries the read path
 * depends on: the anon role can list released games, but the spoiler-gated
 * tables and the results RPC are closed. Creates / modifies / deletes nothing.
 *
 * Skips when Supabase env vars are absent (e.g. CI without secrets).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !publishableKey)("Supabase RLS (read-only, remote)", () => {
  const supabase = createClient<Database>(url!, publishableKey!);

  it("anon may SELECT tierlists (grant + policy exist, no error)", async () => {
    const { error } = await supabase.from("tierlists").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("anon may SELECT tierlist_items (grant + policy exist, no error)", async () => {
    const { error } = await supabase
      .from("tierlist_items")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
  });

  it("anon is denied direct SELECT on tierlist_item_stats (spoiler gate)", async () => {
    const { error } = await supabase
      .from("tierlist_item_stats")
      .select("tierlist_item_id")
      .limit(1);
    expect(error?.code).toBe("42501");
  });

  it("anon is denied direct SELECT on submissions", async () => {
    const { error } = await supabase.from("submissions").select("id").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("get_results refuses a caller with no submission (spoiler gate)", async () => {
    const { error } = await supabase.rpc("get_results", {
      p_tierlist_id: "00000000-0000-0000-0000-000000000000",
      p_guest_id: "00000000-0000-0000-0000-0000000000ff",
    });
    expect(error?.code).toBe("42501");
  });
});
