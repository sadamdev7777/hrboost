"use client";

import { tr, trRalat } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { beritahu, sahkan } from "@/components/Dialog";

/**
 * Selepas meluluskan satu peringkat: jika pengguna yang sama juga pelulus peringkat seterusnya
 * (cth. HR merangkap CEO dalam syarikat kecil), tawarkan untuk meluluskan peringkat itu juga.
 * Tetap tindakan manual (pengguna perlu menekan "Lulus juga") — tiada kelulusan automatik.
 */
export async function tawarLulusBerturut(taskId: string, personId: string): Promise<number> {
  const sb = getSupabase();
  let n = 0;
  const asal = await sb.from("approval_tasks").select("request_id").eq("id", taskId).maybeSingle();
  const req = asal.data?.request_id;
  if (!req) return 0;
  for (let i = 0; i < 5; i++) {
    const t = await sb
      .from("approval_tasks")
      .select("id, step_name")
      .eq("request_id", req)
      .eq("approver_person_id", personId)
      .eq("status", "pending")
      .order("step_order")
      .limit(1)
      .maybeSingle();
    if (!t.data) break;
    const ok = await sahkan({
      tajuk: tr("Anda juga pelulus peringkat {0}", trRalat(t.data.step_name)),
      mesej: tr("Permohonan ini kini menunggu anda sekali lagi di peringkat seterusnya. Lulus peringkat ini juga sekarang?"),
      ok: tr("Lulus juga"),
    });
    if (!ok) break;
    const { error } = await sb.rpc("approval_act", { p_task: t.data.id, p_action: "approve", p_via: "web" });
    if (error) {
      beritahu(trRalat(error.message), "ralat");
      break;
    }
    n++;
  }
  return n;
}
