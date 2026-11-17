// =====================================================================
//  Penyesuai CHIP (chip-in.asia) — gerbang bayaran langganan HRBoost.
//  API Purchases: POST /purchases/ → checkout_url; GET /purchases/{id}/ → status ('paid' apabila berjaya).
//  Bayaran SENTIASA disahkan dengan GET daripada CHIP menggunakan kunci rahsia (callback hanya pencetus),
//  jadi data callback tidak dipercayai.
//
//  Rahsia: CHIP_SECRET_KEY & CHIP_BRAND_ID (Supabase secrets) atau diisi oleh Pentadbir Platform di
//  /admin/tetapan (Vault: chip_secret_key, chip_brand_id). Pilihan: CHIP_API_URL (lalai https://gate.chip-in.asia/api/v1).
// =====================================================================
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.105.0";

export type KunciChip = { secret: string; brand: string; base: string };

export async function kunciChip(sb: SupabaseClient): Promise<KunciChip | null> {
  const env = (n: string) => Deno.env.get(n) || null;
  const vault = async (n: string) => ((await sb.rpc("platform_secret_get", { p_name: n })).data as string | null) || null;
  const secret = env("CHIP_SECRET_KEY") ?? (await vault("chip_secret_key"));
  const brand = env("CHIP_BRAND_ID") ?? (await vault("chip_brand_id"));
  if (!secret || !brand) return null;
  return { secret, brand, base: (env("CHIP_API_URL") ?? "https://gate.chip-in.asia/api/v1").replace(/\/$/, "") };
}

export type PembelianChip = { id: string; checkout_url?: string; status?: string; reference?: string; transaction_data?: { payment_method?: string } };

async function panggil(k: KunciChip, laluan: string, init: RequestInit = {}): Promise<PembelianChip> {
  const res = await fetch(`${k.base}${laluan}`, {
    ...init,
    headers: { Authorization: `Bearer ${k.secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`CHIP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as PembelianChip;
}

/** Cipta pembelian (bayaran sekali) dan dapatkan pautan bayaran. Harga dalam sen. */
export function ciptaPembelian(
  k: KunciChip,
  o: { email: string; nama: string; produk: string; hargaSen: number; rujukan: string; kembali: string; callback: string },
) {
  return panggil(k, "/purchases/", {
    method: "POST",
    body: JSON.stringify({
      brand_id: k.brand,
      reference: o.rujukan,
      client: { email: o.email, full_name: o.nama },
      purchase: { currency: "MYR", products: [{ name: o.produk, price: o.hargaSen, quantity: 1 }] },
      success_redirect: o.kembali,
      failure_redirect: o.kembali,
      cancel_redirect: o.kembali,
      success_callback: o.callback,
      send_receipt: false,
    }),
  });
}

export function dapatkanPembelian(k: KunciChip, id: string) {
  return panggil(k, `/purchases/${encodeURIComponent(id)}/`);
}
