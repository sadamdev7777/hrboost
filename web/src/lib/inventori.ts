"use client";

import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

// Inventori syarikat (migrasi 20261214001800_inventori.sql): item dipegang pekerja atau di lokasi,
// gambar & resit dalam bucket peribadi, rekod pekerja disahkan HR.
export type StatusInventori = "pending" | "verified" | "rejected";
export type KeadaanItem = "baik" | "rosak" | "hilang";

export type ItemInventori = {
  id: string;
  name: string;
  category: string | null;
  brand_model: string | null;
  serial_no: string | null;
  issued_on: string | null;
  returned_on: string | null;
  price: number | null;
  condition: KeadaanItem;
  location: string | null;
  note: string | null;
  photo_paths: string[];
  receipt_paths: string[];
  status: StatusInventori;
  reject_reason: string | null;
  employment_id: string | null;
  holder: string | null;
  department: string | null;
  created_by_name: string | null;
  created_at: string;
  verified_at: string | null;
  editable: boolean;
  holder_active: boolean | null; // null = item di lokasi (tiada pemegang)
  holder_end_date: string | null; // hari bekerja terakhir pemegang (jika dijadualkan / sudah berhenti)
};

/** Item yang dipegang oleh pekerja yang sudah / akan berhenti dan belum dipulangkan. */
export const perluDipulang = (x: ItemInventori) =>
  !!x.employment_id && !x.returned_on && x.status !== "rejected" && (x.holder_active === false || !!x.holder_end_date);

export type DrafInventori = {
  name: string;
  category: string;
  brand_model: string;
  serial_no: string;
  issued_on: string;
  price: string;
  condition: KeadaanItem;
  location: string;
  note: string;
  employment_id: string | null;
  photo_paths: string[];
  receipt_paths: string[];
};

export const KATEGORI_INVENTORI = [
  tr("Komputer riba"),
  tr("Telefon"),
  tr("Tablet"),
  tr("Monitor"),
  tr("Pencetak"),
  tr("Perabot"),
  tr("Kenderaan"),
  tr("Peralatan"),
  tr("Kad akses"),
  tr("Kunci"),
  tr("Pakaian seragam"),
  tr("Lain-lain"),
];

export const LABEL_KEADAAN: Record<KeadaanItem, string> = { baik: tr("Baik"), rosak: tr("Rosak"), hilang: tr("Hilang") };
export const LABEL_STATUS_INVENTORI: Record<StatusInventori, { l: string; tone: "warning" | "success" | "danger" }> = {
  pending: { l: tr("Menunggu semakan HR"), tone: "warning" },
  verified: { l: tr("Disahkan"), tone: "success" },
  rejected: { l: tr("Perlu dibetulkan"), tone: "danger" },
};

export function drafKosong(employmentId: string | null): DrafInventori {
  return {
    name: "",
    category: "",
    brand_model: "",
    serial_no: "",
    issued_on: "",
    price: "",
    condition: "baik",
    location: "",
    note: "",
    employment_id: employmentId,
    photo_paths: [],
    receipt_paths: [],
  };
}

export function drafDaripada(x: ItemInventori): DrafInventori {
  return {
    name: x.name,
    category: x.category ?? "",
    brand_model: x.brand_model ?? "",
    serial_no: x.serial_no ?? "",
    issued_on: x.issued_on ?? "",
    price: x.price != null ? String(x.price) : "",
    condition: x.condition,
    location: x.location ?? "",
    note: x.note ?? "",
    employment_id: x.employment_id,
    photo_paths: x.photo_paths ?? [],
    receipt_paths: x.receipt_paths ?? [],
  };
}

export async function getInventori(companyId: string, skop: "mine" | "all") {
  return (must(await getSupabase().rpc("inventory_list", { p_company: companyId, p_scope: skop })) ?? []) as ItemInventori[];
}
export async function simpanInventori(companyId: string, d: DrafInventori, id?: string) {
  return must(await getSupabase().rpc("inventory_save", { p_company: companyId, p_data: d as never, ...(id ? { p_id: id } : {}) })) as string;
}
export async function sahkanInventori(id: string, ok: boolean, sebab?: string) {
  must(await getSupabase().rpc("hr_inventory_verify", { p_id: id, p_ok: ok, ...(sebab ? { p_reason: sebab } : {}) }));
}
export async function pulangInventori(id: string, tarikh: string) {
  must(await getSupabase().rpc("hr_inventory_return", { p_id: id, p_date: tarikh }));
}
export async function padamInventori(id: string) {
  must(await getSupabase().rpc("inventory_delete", { p_id: id }));
}
