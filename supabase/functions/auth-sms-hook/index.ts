// =====================================================================
//  auth-sms-hook — Supabase Auth "Send SMS" hook (CLAUDE.md §4)
//  Menghantar kod OTP log masuk melalui WhatsApp (Murpati), bukan SMS.
//
//  STATUS: belum dipasang. Butiran API Murpati belum tersedia. Penghantaran
//  melalui supabase/functions/_shared/murpati.ts — laraskan fail itu sahaja.
//
//  Rahsia (Supabase secrets, BUKAN dalam kod):
//    SEND_SMS_HOOK_SECRETS  — rahsia hook daripada papan pemuka Auth > Hooks (format "v1,whsec_...")
//    MURPATI_API_URL        — titik akhir hantar mesej Murpati
//    MURPATI_API_KEY        — kunci API Murpati
//
//  Pasang:   npx supabase functions deploy auth-sms-hook --no-verify-jwt
//  Kemudian: Auth > Hooks > Send SMS hook > HTTPS > URL fungsi ini.
// =====================================================================
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { hantarWhatsApp } from "../_shared/murpati.ts";

type HookPayload = {
  user: { id: string; phone: string };
  sms: { otp: string };
};

function ralat(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ralat(405, "Kaedah tidak dibenarkan");

  const secret = Deno.env.get("SEND_SMS_HOOK_SECRETS")?.replace(/^v1,whsec_/, "");
  if (!secret) return ralat(500, "Rahsia hook belum ditetapkan");

  const body = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(secret).verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return ralat(401, "Tandatangan hook tidak sah");
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) return ralat(400, "Data hook tidak lengkap");

  // Bahasa Melayu rasmi (CLAUDE.md: Bahasa antara muka). Tiada emoji.
  const message = `Kod log masuk HRBoost anda: ${otp}\n\nKod ini sah selama 10 minit. Jangan kongsi kod ini dengan sesiapa, termasuk pihak HR.`;

  const r = await hantarWhatsApp(phone, message);
  if (!r.ok) {
    console.error("auth-sms-hook gagal:", r.error);
    return ralat(502, "Kod tidak dapat dihantar melalui WhatsApp. Sila cuba lagi.");
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
