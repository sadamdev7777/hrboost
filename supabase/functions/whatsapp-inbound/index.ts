// =====================================================================
//  whatsapp-inbound — webhook mesej masuk Murpati (CLAUDE.md §4)
//  "LULUS" / "LULUS 2" / "TOLAK <sebab>" / "TOLAK 2 <sebab>" → approval_act
//  (melalui whatsapp_handle_reply dengan p_on_behalf). Teks lain → Pembantu AI
//  (_shared/pembantu.ts) bagi pihak pekerja yang nombornya sepadan; jika AI belum
//  diaktifkan, dibalas dengan panduan ringkas.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { hantarWhatsApp, tafsirWebhook, webhookSah } from "../_shared/murpati.ts";
import { aiTersedia } from "../_shared/ai.ts";
import { jawab, sediaKonteks } from "../_shared/pembantu.ts";

const PANDUAN =
  "Maaf, mesej ini belum dapat difahami. Untuk permohonan yang menunggu kelulusan anda, balas LULUS atau TOLAK <sebab>. " +
  "Untuk perkara lain, sila gunakan aplikasi HRBoost.";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Kaedah tidak dibenarkan", { status: 405 });
  if (!webhookSah(req)) return new Response("Tidak dibenarkan", { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const msg = body ? tafsirWebhook(body) : null;
  if (!msg) return Response.json({ diabaikan: true });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc("whatsapp_handle_reply", { p_phone: msg.from, p_text: msg.text });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const r = data as { action: string; reply?: string };
  let balas = r.reply;
  if (r.action === "ai") {
    balas = PANDUAN;
    if (aiTersedia()) {
      const tel = msg.from.replace(/\D/g, "");
      const { data: p } = await sb.from("persons").select("id").eq("phone_whatsapp", tel).eq("is_active", true).maybeSingle();
      if (p) {
        try {
          const k = await sediaKonteks(sb, p.id, null, "whatsapp");
          balas = await jawab(k, msg.text);
        } catch (e) {
          balas = e instanceof Error ? e.message : PANDUAN;
        }
      }
    }
  }
  if (balas) await hantarWhatsApp(msg.from.replace(/\D/g, ""), balas);
  return Response.json({ tindakan: r.action });
});
