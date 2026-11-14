// =====================================================================
//  password-reset — lupa kata laluan (tanpa log masuk)
//  POST { action: "request", email }
//       → jika e-mel wujud, hantar pautan {APP_URL}/masuk/set-semula?t=TOKEN melalui Resend.
//         Balasan sentiasa sama (tidak mendedahkan sama ada e-mel berdaftar).
//  POST { action: "reset", token, ic4, password }
//       → sahkan token + 4 digit akhir kad pengenalan (5 cubaan), tukar kata laluan,
//         tamatkan semua sesi lama.
//  Rahsia: RESEND_API_KEY (Supabase secrets) atau kunci Resend dalam Vault (diisi di /admin/tetapan). Pilihan: EMAIL_FROM, APP_URL, RESEND_API_URL.
//  Pautan dibina daripada Origin permintaan jika ia dalam senarai alamat aplikasi yang dibenarkan.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";

const MIN_KATA_LALUAN = 8;

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors() } });
}
function sb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function hantarEmel(ke: string, nama: string, pautan: string, kunci: string) {
  const res = await fetch(Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${kunci}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") ?? "HRBoost <no-reply@hrboost.io>",
      to: [ke],
      subject: "Tetapkan semula kata laluan HRBoost",
      text:
        `Assalamualaikum ${nama},\n\nKami menerima permintaan untuk menetapkan semula kata laluan akaun HRBoost anda. ` +
        `Buka pautan di bawah dan sahkan 4 digit akhir kad pengenalan anda:\n\n${pautan}\n\n` +
        `Pautan ini sah selama 1 jam dan hanya boleh digunakan sekali. Jika anda tidak membuat permintaan ini, abaikan e-mel ini.\n\nHRBoost`,
      html:
        `<div style="font-family:Arial,sans-serif;font-size:15px;color:#14211F;line-height:1.5;max-width:480px">` +
        `<p>Assalamualaikum ${esc(nama)},</p>` +
        `<p>Kami menerima permintaan untuk menetapkan semula kata laluan akaun HRBoost anda. Buka pautan di bawah dan sahkan 4 digit akhir kad pengenalan anda.</p>` +
        `<p><a href="${esc(pautan)}" style="display:inline-block;background:#0F6B5F;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Tetapkan kata laluan baharu</a></p>` +
        `<p style="color:#5B6B68;font-size:13px">Pautan ini sah selama 1 jam dan hanya boleh digunakan sekali. Jika anda tidak membuat permintaan ini, abaikan e-mel ini.</p>` +
        `</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "Kaedah tidak dibenarkan" }, 405);
  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string; token?: string; ic4?: string; password?: string };
  const db = sb();

  try {
    if (body.action === "request") {
      const email = String(body.email ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Sila masukkan alamat e-mel yang sah." }, 400);
      // Kunci: Supabase secrets, atau yang diisi oleh Pentadbir Platform di /admin/tetapan (Vault)
      const kunci = Deno.env.get("RESEND_API_KEY") ?? ((await db.rpc("platform_secret_get", { p_name: "resend_api_key" })).data as string | null);
      if (!kunci) {
        return json({ code: "tiada_emel", error: "Penghantaran e-mel belum diaktifkan. Sila hubungi HR syarikat anda." }, 503);
      }
      const { data, error } = await db.rpc("password_reset_create", { p_email: email });
      if (error) throw error;
      const r = (data as { token: string; name: string; email: string }[] | null)?.[0];
      if (r) {
        // Pautan hanya ke alamat aplikasi yang dibenarkan (elak pautan pancingan melalui pengepala Origin).
        const dibenar = [Deno.env.get("APP_URL"), "https://hrboost.io", "https://www.hrboost.io", "https://hrboost-staging.netlify.app", "http://localhost:3000"]
          .filter((x): x is string => !!x)
          .map((x) => x.replace(/\/$/, ""));
        const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
        const asas = dibenar.includes(origin) ? origin : dibenar[0];
        await hantarEmel(r.email, r.name, `${asas}/masuk/set-semula?t=${r.token}`, kunci);
      }
      return json({ ok: true });
    }

    if (body.action === "reset") {
      const password = String(body.password ?? "");
      if (password.length < MIN_KATA_LALUAN) return json({ error: `Kata laluan mestilah sekurang-kurangnya ${MIN_KATA_LALUAN} aksara.` }, 400);
      const ic4 = String(body.ic4 ?? "").replace(/\D/g, "");
      if (ic4.length !== 4) return json({ error: "Sila masukkan 4 digit akhir kad pengenalan." }, 400);
      const { data, error } = await db.rpc("password_reset_check", { p_token: String(body.token ?? ""), p_ic_last4: ic4 });
      if (error) throw error;
      const r = data as { ok: boolean; user_id?: string; error?: string; code?: string; attempts_left?: number };
      if (!r.ok) return json(r, 400);
      const { error: uErr } = await db.auth.admin.updateUserById(r.user_id!, { password });
      if (uErr) return json({ error: "Kata laluan tidak dapat ditukar. Pilih kata laluan yang lebih kukuh." }, 400);
      const { error: fErr } = await db.rpc("password_reset_finish", { p_token: String(body.token ?? "") });
      if (fErr) throw fErr;
      return json({ ok: true });
    }

    return json({ error: "Tindakan tidak sah" }, 400);
  } catch (e) {
    console.error("password-reset:", e instanceof Error ? e.message : e);
    return json({ error: "Permintaan tidak dapat diproses. Sila cuba sebentar lagi." }, 500);
  }
});
