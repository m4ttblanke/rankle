"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out (Milestone 6). Clears the Supabase auth session cookie only —
 * never touches the `rankle_guest` cookie, so anonymous play is unaffected
 * (docs/MANUAL.md: signing out must not break guest gameplay).
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
