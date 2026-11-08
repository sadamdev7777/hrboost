// =====================================================================
//  notify-sender — hantar notifikasi WhatsApp yang beratur (CLAUDE.md §4)
//  Jadual: setiap minit (pg_cron + pg_net, lihat README).
//  Aliran: notify_next() [semak had, tanda skipped jika habis] → Murpati → notify_mark().
//  Jika Murpati belum dikonfigurasi, tiada apa-apa diambil: notifikasi kekal 'pending'.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { hantarWhatsApp, murpatiTersedia } from "../_shared/murpati.ts";

Deno.serve(async (req) => {
  // Dipanggil oleh pg_cron dengan kunci service role sahaja.
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("Authorization") !== `Bearer ${service}`) {
    return new Response("Tidak dibenarkan", { status: 401 });
  }
  if (!murpatiTersedia()) {
    return Response.json({ dihantar: 0, nota: "Murpati belum dikonfigurasi; notifikasi kekal dalam giliran." });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, service, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("notify_next", { p_limit: 50 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let ok = 0;
  let gagal = 0;
  for (const n of data ?? []) {
    const r = await hantarWhatsApp(n.to_address, n.message);
    await sb.rpc("notify_mark", {
      p_id: n.id,
      p_ok: r.ok,
      p_provider_ref: r.ok ? r.ref : null,
      p_error: r.ok ? null : r.error,
    });
    if (r.ok) ok++;
    else gagal++;
  }
  return Response.json({ dihantar: ok, gagal });
});
