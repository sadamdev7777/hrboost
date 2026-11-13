"use client";

import { getSupabase } from "./supabase";
import { useData } from "./useData";

// Saluran notifikasi (migrasi 20261214001500_saluran_notifikasi.sql).
// Loceng dalam aplikasi sentiasa aktif; WhatsApp (Murpati) dan e-mel (Resend) ialah pilihan.
export type Saluran = {
  whatsapp: boolean; // WhatsApp automatik aktif untuk syarikat ini
  email: boolean; // e-mel automatik aktif untuk syarikat ini
  whatsapp_ready: boolean; // Murpati dikonfigurasi pada platform
  email_ready: boolean; // Resend dikonfigurasi pada platform
  company_whatsapp: boolean;
  company_email: boolean;
};

const TIADA: Saluran = { whatsapp: false, email: false, whatsapp_ready: false, email_ready: false, company_whatsapp: true, company_email: true };

export async function getSaluran(companyId: string): Promise<Saluran> {
  const { data } = await getSupabase().rpc("notify_channels", { p_company: companyId });
  return { ...TIADA, ...((data as Partial<Saluran> | null) ?? {}) };
}

export function useSaluran(companyId: string | undefined) {
  const d = useData(() => (companyId ? getSaluran(companyId) : Promise.resolve(TIADA)), [companyId]);
  return { ...(d.data ?? TIADA), muat: !d.data, reload: d.reload };
}

export async function setSaluran(companyId: string, wa: boolean, emel: boolean) {
  const { error } = await getSupabase().rpc("set_notify_channels", { p_company: companyId, p_wa: wa, p_email: emel });
  if (error) throw new Error(error.message);
}

/** No. telefon Malaysia → format antarabangsa tanpa "+" (0123456789 → 60123456789). */
export function msisdn(no: string | null | undefined): string | null {
  const d = (no ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("60")) return d;
  if (d.startsWith("0")) return "6" + d;
  return d;
}

/**
 * Pautan WhatsApp "klik untuk berbual" dengan teks siap diisi. Dihantar dari WhatsApp pengguna sendiri,
 * jadi tidak memerlukan Murpati. Tanpa nombor → pengguna memilih penerima dalam WhatsApp.
 */
export function pautanWa(no: string | null | undefined, teks: string): string {
  const n = msisdn(no);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(teks)}`;
}

export function bukaWa(no: string | null | undefined, teks: string) {
  window.open(pautanWa(no, teks), "_blank", "noopener");
}

/** Teks jemputan dalam bahasa pekerja (sama seperti mesej sistem). */
export function teksJemputan(nama: string, syarikat: string, url: string, bahasa: string | null | undefined) {
  return bahasa === "ms"
    ? `Assalamualaikum ${nama}, anda dijemput menyertai ${syarikat} di HRBoost. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda: ${url} (sah selama 7 hari)`
    : `Assalamualaikum ${nama}, you are invited to join ${syarikat} on HRBoost. Open this link and confirm the last 4 digits of your IC: ${url} (valid for 7 days)`;
}
