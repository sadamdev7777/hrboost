// =====================================================================
//  notify-sender — hantar notifikasi yang beratur (CLAUDE.md §4)
//  Jadual: setiap minit (pg_cron + pg_net, lihat README).
//  Saluran: WhatsApp (Murpati, jika dikonfigurasi & syarikat membenarkan) → e-mel (Resend) →
//  dalam aplikasi sahaja. Notifikasi sentiasa dipaparkan pada loceng dalam aplikasi; saluran luar
//  hanyalah tambahan. notify_next2() memilih saluran bagi setiap notifikasi.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { hantarWhatsApp, murpatiTersedia } from "../_shared/murpati.ts";
import { hantarEmelNotifikasi, kunciResend } from "../_shared/emel.ts";

Deno.serve(async (req) => {
  // Dipanggil oleh pg_cron: sama ada kunci service role, atau rahsia jadual (x-cron-secret) yang
  // disimpan dalam Vault ('notify_cron_secret') dan disemak melalui notify_cron_check().
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, service, { auth: { persistSession: false } });
  let dibenarkan = req.headers.get("Authorization") === `Bearer ${service}`;
  if (!dibenarkan) {
    const rahsia = req.headers.get("x-cron-secret");
    if (rahsia) dibenarkan = (await sb.rpc("notify_cron_check", { p_secret: rahsia })).data === true;
  }
  if (!dibenarkan) return new Response("Tidak dibenarkan", { status: 401 });
  const wa = murpatiTersedia();
  const kunci = await kunciResend(sb);
  const emel = !!kunci;

  // Laporkan saluran yang tersedia supaya aplikasi memaparkan teks yang betul
  await sb.rpc("notify_set_channels", { p_wa: wa, p_email: emel });

  // Tiada saluran luar langsung (cth. kunci Resend belum diisi): biarkan giliran; notifikasi kekal dalam aplikasi
  // dan akan dihantar sebaik sahaja saluran tersedia (notifikasi > 3 hari dilangkau oleh notify_next2).
  if (!wa && !emel) return Response.json({ saluran: { whatsapp: wa, email: emel }, nota: "Tiada saluran luar dikonfigurasi" });

  const { data, error } = await sb.rpc("notify_next2", { p_limit: 50, p_wa: wa, p_email: emel });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const kira = { whatsapp: 0, email: 0, gagal: 0 };
  for (const n of data ?? []) {
    const r = n.channel === "email" ? await hantarEmelNotifikasi(n.to_address, n.message, n.language, kunci) : await hantarWhatsApp(n.to_address, n.message);
    await sb.rpc("notify_mark", {
      p_id: n.id,
      p_ok: r.ok,
      p_provider_ref: r.ok ? r.ref : null,
      p_error: r.ok ? null : r.error,
    });
    if (!r.ok) kira.gagal++;
    else if (n.channel === "email") kira.email++;
    else kira.whatsapp++;
  }
  return Response.json({ saluran: { whatsapp: wa, email: emel }, ...kira });
});
