import { createClient } from "@/lib/supabase/server";

/**
 * Current-identity readers (Milestone 6). Both are small, purpose-built
 * server-only readers — same shape as `getGuestId()` / `getDailyGame()` —
 * not a general auth abstraction.
 */

export type CurrentUser = { id: string; email: string | null };

/**
 * The current Supabase Auth user, or `null` if signed out. Uses
 * `auth.getUser()` (validates the JWT against the server), never
 * `auth.getSession()` (which only reads the cookie without revalidating) —
 * the correct choice whenever the result gates access to anything.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}

export type CurrentProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

/**
 * The current user's own profile row, or `null` if signed out or (should
 * never happen — `handle_new_user` creates one at signup) missing. A plain
 * RLS-gated `SELECT` on the caller's own row — no RPC needed.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  };
}
