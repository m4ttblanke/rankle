import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { assertLoopbackUrl, loadEnvTest } from "@/lib/test-support/local-env";
import type { Database } from "@/lib/supabase/types";

/**
 * Real end-to-end path for the Milestone 8 admin RPCs, through the actual
 * JS/PostgREST client — not raw SQL. `supabase/tests/rls_spec.sql` already
 * exhaustively covers the authorization/invariant matrix at the SQL level;
 * this file exists to catch the class of bug that only shows up at the
 * PostgREST boundary (argument name/shape mismatches, jsonb serialization,
 * single-vs-setof return shape) — mirrors
 * `claim-guest-submissions.integration.test.ts`'s real-session approach.
 *
 * Skips entirely when `.env.test` is absent or `SUPABASE_SERVICE_ROLE_KEY`
 * is unset (e.g. CI without Docker).
 */

const env = loadEnvTest();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !anonKey || !serviceKey)("admin RPCs, real session (local Supabase)", () => {
  if (url) assertLoopbackUrl(url);

  const admin = createClient<Database>(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function signInAsFreshUser(): Promise<{ userId: string; client: ReturnType<typeof createClient<Database>> }> {
    const email = `test-${randomUUID()}@rankle.test`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (createErr || !created.user) throw createErr ?? new Error("createUser failed");

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link) throw linkErr ?? new Error("generateLink failed");

    const sessionClient = createClient<Database>(url!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: verified, error: verifyErr } = await sessionClient.auth.verifyOtp({
      type: "email",
      token_hash: link.properties.hashed_token,
    });
    if (verifyErr || !verified.session) throw verifyErr ?? new Error("verifyOtp failed");

    return { userId: created.user.id, client: sessionClient };
  }

  async function signInAsFreshAdmin() {
    const { userId, client } = await signInAsFreshUser();
    const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
    if (error) throw error;
    return { userId, client };
  }

  it("is_admin_user: false for a fresh non-admin, true after bootstrap", async () => {
    const { client } = await signInAsFreshUser();
    expect(await client.rpc("is_admin_user")).toMatchObject({ data: false, error: null });

    const { client: adminClient } = await signInAsFreshAdmin();
    expect(await adminClient.rpc("is_admin_user")).toMatchObject({ data: true, error: null });
  });

  it("get_daily_game: anon and a real admin session resolve the identical game", async () => {
    const anon = createClient<Database>(url!, anonKey!);
    const { data: anonGame } = await anon.rpc("get_daily_game");

    const { client: adminClient } = await signInAsFreshAdmin();
    const { data: adminGame } = await adminClient.rpc("get_daily_game");

    expect((adminGame as { slug?: string } | null)?.slug).toBe((anonGame as { slug?: string } | null)?.slug);
  });

  it("full admin lifecycle: create draft -> set items -> schedule -> unschedule -> duplicate -> delete", async () => {
    const { client: adminClient } = await signInAsFreshAdmin();
    const slug = `test-admin-${randomUUID().slice(0, 8)}`;

    const { data: created, error: createErr } = await adminClient
      .from("tierlists")
      .insert({ slug, title: "Integration Test Draft" })
      .select("id, status, release_date, tier_config")
      .single();
    expect(createErr).toBeNull();
    expect(created?.status).toBe("draft");
    expect(created?.release_date).toBeNull();
    expect(created?.tier_config).toEqual(["S", "A", "B", "C", "F", "N/A"]);
    const id = created!.id;

    const { error: itemsErr } = await adminClient.rpc("set_tierlist_items", {
      p_tierlist_id: id,
      p_items: [
        { label: "Alpha", sort_order: 0 },
        { label: "Beta", sort_order: 1 },
      ],
    });
    expect(itemsErr).toBeNull();

    const future = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const { data: scheduled, error: scheduleErr } = await adminClient.rpc("schedule_tierlist", {
      p_tierlist_id: id,
      p_release_date: future,
    });
    expect(scheduleErr).toBeNull();
    expect((scheduled as { status?: string } | null)?.status).toBe("scheduled");

    const { data: unscheduled, error: unscheduleErr } = await adminClient.rpc("unschedule_tierlist", {
      p_tierlist_id: id,
    });
    expect(unscheduleErr).toBeNull();
    expect((unscheduled as { status?: string; release_date?: string | null } | null)?.status).toBe("draft");
    expect((unscheduled as { release_date?: string | null } | null)?.release_date).toBeNull();

    const { data: duplicated, error: duplicateErr } = await adminClient.rpc("duplicate_tierlist", {
      p_source_id: id,
      p_new_slug: `${slug}-copy`,
    });
    expect(duplicateErr).toBeNull();
    const dupId = (duplicated as { id?: string } | null)?.id;
    expect(dupId).toBeTruthy();
    expect(dupId).not.toBe(id);

    const { count } = await adminClient
      .from("tierlist_items")
      .select("id", { count: "exact", head: true })
      .eq("tierlist_id", dupId as string);
    expect(count).toBe(2);

    const { error: deleteErr } = await adminClient.from("tierlists").delete().eq("id", id);
    expect(deleteErr).toBeNull();
    await adminClient.from("tierlists").delete().eq("id", dupId as string);
  });

  it("a non-admin session is refused by every admin RPC", async () => {
    const { client } = await signInAsFreshUser();
    const bogusId = randomUUID();

    expect((await client.rpc("schedule_tierlist", { p_tierlist_id: bogusId, p_release_date: "2099-01-01" })).error?.code).toBe(
      "42501",
    );
    expect((await client.rpc("unschedule_tierlist", { p_tierlist_id: bogusId })).error?.code).toBe("42501");
    expect((await client.rpc("duplicate_tierlist", { p_source_id: bogusId, p_new_slug: "nope" })).error?.code).toBe(
      "42501",
    );
    expect(
      (await client.rpc("set_tierlist_items", { p_tierlist_id: bogusId, p_items: [{ label: "X", sort_order: 0 }] }))
        .error?.code,
    ).toBe("42501");
  });
});
