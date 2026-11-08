// =====================================================================
//  Penyesuai WhatsApp (Murpati) — satu-satunya tempat yang perlu dilaraskan
//  bila spesifikasi API Murpati tersedia.
//
//  Rahsia (Supabase secrets, bukan dalam kod):
//    MURPATI_API_URL         — titik akhir hantar mesej
//    MURPATI_API_KEY         — kunci API
//    MURPATI_WEBHOOK_SECRET  — rahsia kongsi untuk webhook mesej masuk
// =====================================================================

export type HasilHantar = { ok: true; ref: string | null } | { ok: false; error: string };

export function murpatiTersedia(): boolean {
  return !!Deno.env.get("MURPATI_API_URL") && !!Deno.env.get("MURPATI_API_KEY");
}

/** Hantar mesej teks WhatsApp. `phone` dalam format 60XXXXXXXXX. */
export async function hantarWhatsApp(phone: string, message: string): Promise<HasilHantar> {
  const url = Deno.env.get("MURPATI_API_URL");
  const key = Deno.env.get("MURPATI_API_KEY");
  if (!url || !key) return { ok: false, error: "Murpati belum dikonfigurasi" };
  try {
    // TODO(Murpati): sahkan format permintaan & respons sebenar (medan, pengesahan, id mesej).
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to: phone, message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Murpati ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
    return { ok: true, ref: (body?.id ?? body?.message_id ?? null) as string | null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type MesejMasuk = { from: string; text: string };

/**
 * Tafsir webhook mesej masuk daripada Murpati.
 * TODO(Murpati): laraskan nama medan mengikut format webhook sebenar.
 */
export function tafsirWebhook(body: Record<string, unknown>): MesejMasuk | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = k.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined), body);
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const from = pick("from", "sender", "phone", "message.from", "data.from");
  const text = pick("text", "message", "body", "message.text", "data.text", "data.body");
  return from && text ? { from, text } : null;
}

/** Semak rahsia webhook (pengepala `x-webhook-secret` atau `?secret=`). */
export function webhookSah(req: Request): boolean {
  const secret = Deno.env.get("MURPATI_WEBHOOK_SECRET");
  if (!secret) return false;
  const got = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!got || got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
