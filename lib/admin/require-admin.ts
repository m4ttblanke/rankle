import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate (Milestone 8). `profiles.is_admin` has no client
 * SELECT grant at all (migration 1), so admin status can't be read from a
 * plain table query — `is_admin_user()` is a thin SECURITY DEFINER RPC
 * wrapping `private.is_admin()` for exactly this purpose (docs/SECURITY.md
 * sec 4). Every admin route and Server Action calls this independently; it
 * is the actual authorization boundary, not the presence/absence of a nav
 * link.
 *
 * Redirects (never renders a "forbidden" page that would confirm `/admin`
 * exists to a non-admin) — signed out and non-admin are treated identically.
 */
export async function requireAdmin(): Promise<{ id: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin_user");
  if (error || !data) redirect("/");

  return { id: user.id };
}

/** Same check, without redirecting — for Server Actions, which return a
 *  typed result instead of throwing a navigation redirect. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin_user");
  return !error && data === true;
}
