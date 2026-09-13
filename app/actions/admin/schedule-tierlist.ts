"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin/require-admin";
import { scheduleTierlistSchema } from "@/lib/admin/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Schedule (or reschedule) a draft for a release date (Milestone 8). Calls
 * `schedule_tierlist()` — a narrow transactional RPC, not a plain table
 * update, because this transition has real invariants to check atomically:
 * no past dates, the pre-existing `tierlists_release_date_key` unique index
 * (one official game per release date), and the historical lock once
 * submissions exist. `is_admin()` is re-verified inside the RPC regardless
 * of the `isCurrentUserAdmin()` check below.
 */

export type ScheduleTierlistResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "past" | "taken" | "locked" | "not_found" | "network" };

export async function scheduleTierlist(input: unknown): Promise<ScheduleTierlistResult> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, reason: "forbidden" };
  }

  const parsed = scheduleTierlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("schedule_tierlist", {
      p_tierlist_id: parsed.data.id,
      p_release_date: parsed.data.releaseDate,
    });

    if (error) {
      const reason = mapError(error.code);
      console.error(`[schedule-tierlist] rpc rejected (reason=${reason}) code=${error.code ?? "?"}`);
      return { ok: false, reason };
    }

    revalidatePath(`/admin/tierlists/${parsed.data.id}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[schedule-tierlist] unexpected failure", err);
    return { ok: false, reason: "network" };
  }
}

type ScheduleFailureReason = Extract<ScheduleTierlistResult, { ok: false }>["reason"];

function mapError(code: string | undefined): ScheduleFailureReason {
  switch (code) {
    case "22023":
      return "past";
    case "23505":
      return "taken";
    case "23001":
      return "locked";
    case "P0002":
      return "not_found";
    case "42501":
      return "forbidden";
    default:
      return "network";
  }
}
