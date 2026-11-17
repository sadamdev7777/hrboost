// =====================================================================
//  billing — langganan HRBoost melalui CHIP
//  POST { action: "checkout", company, code?, base_url }  (JWT pengguna; Pentadbir/HR/CEO/Kewangan)
//       → cipta invois (billing_create_invoice sebagai pengguna) → pembelian CHIP → { url }
//         Jumlah RM0 (baucar 100%) → terus dibayar tanpa CHIP → { url: halaman selesai }
//  POST { action: "verify", invoice }  (halaman /langganan/selesai) → semak status di CHIP → { status }
//  POST ?webhook=1  (success_callback CHIP; body = objek pembelian) → semak status di CHIP
//  Bayaran hanya ditanda dibayar selepas GET /purchases/{id}/ daripada CHIP memulangkan status 'paid'
//  dan rujukan sepadan dengan nombor invois.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.105.0";
import { cors, json, serviceClient } from "../_shared/ai.ts";
import { ciptaPembelian, dapatkanPembelian, kunciChip } from "../_shared/chip.ts";

type Invois = { id: string; number: string; status: string; total_sen: number; chip_purchase_id: string | null; payer_email: string | null; payer_name: string | null; buyer: { name?: string } };

async function sahkan(sb: ReturnType<typeof serviceClient>, inv: Invois): Promise<string> {
  if (inv.status !== "pending" || !inv.chip_purchase_id) return inv.status;
  const k = await kunciChip(sb);
  if (!k) return inv.status;
  const p = await dapatkanPembelian(k, inv.chip_purchase_id);
  if (p.status === "paid" && (!p.reference || p.reference === inv.number)) {
    const { error } = await sb.rpc("billing_mark_paid", { p_invoice: inv.id, p_purchase: p.id, p_method: p.transaction_data?.payment_method ?? null });
    if (error) throw new Error(error.message);
    return "paid";
  }
  return inv.status;
}

async function invois(sb: ReturnType<typeof serviceClient>, id: string): Promise<Invois | null> {
  const { data } = await sb.rpc("billing_invoice_for_checkout", { p_invoice: id });
  return (data as Invois | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "Kaedah tidak dibenarkan" }, 405);
  const sb = serviceClient();
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    // Callback CHIP: cari invois melalui ID pembelian, kemudian sahkan dengan CHIP
    if (url.searchParams.get("webhook") === "1") {
      const pid = String(body.id ?? "");
      if (!pid) return json({ ok: true });
      const { data } = await sb.from("billing_invoices").select("id").eq("chip_purchase_id", pid).maybeSingle();
      if (data) {
        const inv = await invois(sb, data.id);
        if (inv) await sahkan(sb, inv);
      }
      return json({ ok: true });
    }

    if (body.action === "verify") {
      const inv = await invois(sb, String(body.invoice ?? ""));
      if (!inv) return json({ error: "Invois tidak dijumpai" }, 404);
      return json({ status: await sahkan(sb, inv) });
    }

    if (body.action === "checkout") {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Sila log masuk" }, 401);
      const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false },
      });
      const k = await kunciChip(sb);
      // Invois dicipta sebagai pengguna (kebenaran & baucar disemak oleh pangkalan data)
      const { data: inv0, error } = await user.rpc("billing_create_invoice", { p_company: String(body.company ?? ""), p_code: (body.code as string) || null });
      if (error) return json({ error: error.message }, 400);
      const inv = inv0 as Invois;
      const asas = String(body.base_url ?? Deno.env.get("APP_URL") ?? "https://hrboost.io").replace(/\/$/, "");
      if (!/^https?:\/\/[^\s/]+$/.test(asas)) return json({ error: "Alamat aplikasi tidak sah" }, 400);
      const kembali = `${asas}/langganan/selesai?inv=${inv.id}`;
      if (inv.total_sen <= 0) {
        await sb.rpc("billing_mark_paid", { p_invoice: inv.id, p_purchase: null, p_method: "baucar" });
        return json({ url: kembali, invoice: inv.id });
      }
      if (!k) return json({ error: "Bayaran dalam talian belum diaktifkan. Sila hubungi HRBoost.", code: "tiada_kunci" }, 503);
      const p = await ciptaPembelian(k, {
        email: inv.payer_email ?? "",
        nama: inv.payer_name ?? inv.buyer?.name ?? "",
        produk: `HRBoost — Langganan 1 tahun (${inv.buyer?.name ?? ""})`,
        hargaSen: inv.total_sen,
        rujukan: inv.number,
        kembali,
        callback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/billing?webhook=1`,
      });
      if (!p.checkout_url) throw new Error("CHIP tidak memulangkan pautan bayaran");
      await sb.rpc("billing_set_checkout", { p_invoice: inv.id, p_purchase: p.id, p_url: p.checkout_url });
      return json({ url: p.checkout_url, invoice: inv.id });
    }

    return json({ error: "Tindakan tidak sah" }, 400);
  } catch (e) {
    console.error("billing:", e instanceof Error ? e.message : e);
    return json({ error: "Bayaran tidak dapat diproses. Sila cuba sebentar lagi." }, 502);
  }
});
