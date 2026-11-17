"use client";

import { tr, trRalat } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";

/** Langganan HRBoost (RM499 setahun, percubaan percuma, bayaran CHIP). Lihat migrasi 20261214002500_langganan.sql. */
export type StatusLangganan = "trial" | "active" | "grace" | "readonly" | "exempt";

export type Langganan = {
  status: StatusLangganan;
  ends_at: string | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  days_left: number | null;
  readonly_at: string | null;
  price_sen: number;
  can_pay: boolean;
};

export type SebutHarga = {
  price_sen: number;
  discount_sen: number;
  total_sen: number;
  voucher_id: string | null;
  voucher_name: string | null;
  voucher_code: string | null;
  voucher_kind: "percent" | "fixed" | null;
  voucher_value: number | null;
  code_error: string | null;
};

export type Invois = {
  id: string;
  number: string;
  company_id: string;
  description: string;
  period_start: string | null;
  period_end: string | null;
  subtotal_sen: number;
  discount_sen: number;
  total_sen: number;
  voucher_label: string | null;
  status: "pending" | "paid" | "cancelled";
  chip_purchase_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  receipt_number: string | null;
  buyer: { name?: string; reg_no?: string | null; address?: string | null; code?: string };
  seller: { name?: string; ssm?: string; address?: string; email?: string; phone?: string };
  payer_name: string | null;
  payer_email: string | null;
  created_at: string;
};

export const rmSen = (sen: number) => "RM" + (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const LABEL_STATUS = (): Record<StatusLangganan, string> => ({
  trial: tr("Percubaan percuma"),
  active: tr("Aktif"),
  grace: tr("Tempoh tangguh"),
  readonly: tr("Tamat — baca sahaja"),
  exempt: tr("Dikecualikan"),
});

export async function getLangganan(companyId: string): Promise<Langganan> {
  return must(await getSupabase().rpc("billing_status", { p_company: companyId })) as unknown as Langganan;
}

export async function sebutHarga(companyId: string, kod?: string): Promise<SebutHarga> {
  return must(await getSupabase().rpc("billing_quote", { p_company: companyId, p_code: kod || undefined })) as unknown as SebutHarga;
}

export async function getInvois(companyId: string): Promise<Invois[]> {
  return (must(await getSupabase().rpc("billing_invoices_list", { p_company: companyId })) ?? []) as unknown as Invois[];
}

export async function getSatuInvois(id: string): Promise<Invois> {
  return must(await getSupabase().rpc("billing_invoice_view", { p_id: id })) as unknown as Invois;
}

async function panggilBilling(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase().functions.invoke("billing", { body });
  if (error) {
    // Mesej daripada fungsi (cth. kod baucar tidak sah) dalam badan respons
    const ctx = (error as { context?: Response }).context;
    const b = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(trRalat((b as { error?: string } | null)?.error ?? tr("Bayaran tidak dapat diproses. Sila cuba sebentar lagi.")));
  }
  return data as Record<string, unknown>;
}

/** Cipta invois & pembelian CHIP; pulangkan pautan bayaran (atau halaman selesai jika jumlah RM0). */
export async function mulaBayar(companyId: string, kod?: string): Promise<string> {
  const r = await panggilBilling({ action: "checkout", company: companyId, code: kod || null, base_url: window.location.origin });
  return String(r.url);
}

/** Semak status bayaran dengan CHIP (selepas kembali dari halaman bayaran). */
export async function sahkanBayaran(invoiceId: string): Promise<string> {
  const r = await panggilBilling({ action: "verify", invoice: invoiceId });
  return String(r.status);
}

// ---------------------------------------------------------------- Pentadbir Platform
export type Baucar = {
  id: string;
  code: string | null;
  name: string;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  active: boolean;
  note: string | null;
  used: number;
  created_at: string;
};

export type RingkasanLangganan = {
  company_id: string;
  code: string;
  name: string;
  billing_status: StatusLangganan;
  trial_ends_at: string | null;
  paid_until: string | null;
  created_at: string;
  paid_total_sen: number;
  last_paid_at: string | null;
};

export type TetapanBil = {
  price_sen: number;
  trial_days: number;
  grace_days: number;
  seller: { name: string; ssm: string; address: string; email: string; phone: string };
};

export async function getBaucar(): Promise<Baucar[]> {
  return (must(await getSupabase().rpc("sa_vouchers")) ?? []) as unknown as Baucar[];
}
export async function simpanBaucar(data: Record<string, unknown>, id?: string | null) {
  return must(await getSupabase().rpc("sa_voucher_save", { p_data: data as never, p_id: id ?? undefined }));
}
export async function getRingkasanLangganan(): Promise<RingkasanLangganan[]> {
  return (must(await getSupabase().rpc("sa_billing_overview")) ?? []) as unknown as RingkasanLangganan[];
}
export async function setLangganan(companyId: string, status: StatusLangganan, hingga?: string | null) {
  must(await getSupabase().rpc("sa_billing_set", { p_company: companyId, p_status: status, p_until: hingga ?? undefined }));
}
export async function getTetapanBil(): Promise<TetapanBil> {
  return must(await getSupabase().rpc("sa_billing_settings")) as unknown as TetapanBil;
}
export async function simpanTetapanBil(t: TetapanBil) {
  must(await getSupabase().rpc("sa_billing_settings_set", { p_data: t as never }));
}
export type InvoisRingkas = {
  id: string;
  number: string;
  company_name: string;
  total_sen: number;
  discount_sen: number;
  voucher_label: string | null;
  status: string;
  paid_at: string | null;
  receipt_number: string | null;
  created_at: string;
};
export async function getSemuaInvois(): Promise<InvoisRingkas[]> {
  return (must(await getSupabase().rpc("sa_billing_invoices", {})) ?? []) as unknown as InvoisRingkas[];
}
