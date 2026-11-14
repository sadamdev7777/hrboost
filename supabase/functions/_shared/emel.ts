// =====================================================================
//  Penyesuai e-mel (Resend). Digunakan oleh notify-sender untuk notifikasi apabila
//  WhatsApp (Murpati) tidak disambung atau pekerja tiada nombor WhatsApp.
//
//  Rahsia (Supabase secrets, bukan dalam kod):
//    RESEND_API_KEY   — kunci API Resend (kebenaran "Sending access")
//    EMAIL_FROM       — cth. "HRBoost <notifikasi@hrboost.io>" (domain mesti disahkan di Resend)
//    APP_URL          — alamat aplikasi untuk butang "Buka HRBoost" (lalai https://hrboost.io)
// =====================================================================

export type HasilEmel = { ok: true; ref: string | null } | { ok: false; error: string };

export function emelTersedia(): boolean {
  return !!Deno.env.get("RESEND_API_KEY");
}

/**
 * Kunci Resend: pembolehubah persekitaran (Supabase secrets) diutamakan; jika tiada, kunci yang
 * diisi oleh Pentadbir Platform di /admin/tetapan (Vault, melalui platform_secret_get).
 */
// deno-lint-ignore no-explicit-any
export async function kunciResend(sb: any): Promise<string | null> {
  const env = Deno.env.get("RESEND_API_KEY");
  if (env) return env;
  const { data } = await sb.rpc("platform_secret_get", { p_name: "resend_api_key" });
  return typeof data === "string" && data ? data : null;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Pautan dalam teks dijadikan boleh ditekan (selepas escape). */
function pautkan(html: string) {
  return html.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#0F6B5F">${u}</a>`);
}

/** Hantar notifikasi teks sebagai e-mel ringkas. `bahasa`: 'ms' | 'en'. */
export async function hantarEmelNotifikasi(ke: string, mesej: string, bahasa: string, kunci?: string | null): Promise<HasilEmel> {
  const key = kunci ?? Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "Resend belum dikonfigurasi" };
  const ms = bahasa === "ms";
  const app = (Deno.env.get("APP_URL") ?? "https://hrboost.io").replace(/\/$/, "");
  const ringkas = mesej.replace(/\s+/g, " ").trim();
  const subjek = (ringkas.length > 70 ? ringkas.slice(0, 67).trimEnd() + "…" : ringkas) || (ms ? "Pemberitahuan HRBoost" : "HRBoost notification");
  const butang = ms ? "Buka HRBoost" : "Open HRBoost";
  const kaki = ms
    ? "Anda menerima e-mel ini kerana anda pengguna HRBoost syarikat anda. Pemberitahuan yang sama juga dipaparkan pada loceng dalam aplikasi."
    : "You are receiving this email because you use HRBoost at your company. The same notification is also shown in the bell inside the app.";
  try {
    const res = await fetch(Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") ?? "HRBoost <no-reply@hrboost.io>",
        to: [ke],
        subject: subjek,
        text: `${mesej}\n\n${butang}: ${app}\n\n${kaki}`,
        html:
          `<div style="font-family:Arial,sans-serif;font-size:15px;color:#14211F;line-height:1.55;max-width:520px">` +
          `<p style="white-space:pre-line">${pautkan(esc(mesej))}</p>` +
          `<p><a href="${esc(app)}" style="display:inline-block;background:#0F6B5F;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${butang}</a></p>` +
          `<p style="color:#5B6B68;font-size:12px">${kaki}</p>` +
          `</div>`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
    return { ok: true, ref: (body as { id?: string }).id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
