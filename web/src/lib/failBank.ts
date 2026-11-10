"use client";

// Fail bayaran gaji mengikut format bank. Fail dibina di pelayar daripada baris bayaran
// (RPC payroll_bank_rows) mengikut susunan lajur yang dipilih HR. Pratetap ialah titik mula —
// susunan lajur sebenar mesti sepadan dengan templat yang dimuat turun daripada portal bank syarikat.
import { tr } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";

export type MedanBank =
  | "nama" | "no_akaun" | "bic" | "nama_bank" | "amaun" | "no_kp" | "jenis_id" | "rujukan" | "keterangan" | "tarikh" | "no_pekerja" | "emel" | "tetap";

export type LajurBank = { medan: MedanBank; tajuk: string; nilai?: string };
export type FormatBank = {
  id: string;
  nama: string;
  columns: LajurBank[];
  pemisah: "," | ";" | "|" | "\t";
  kepala: boolean;
  tarikh: "DD/MM/YYYY" | "YYYYMMDD" | "DD-MM-YYYY" | "YYYY-MM-DD";
  amaun: "titik" | "sen" | "koma_ribu";
  hurufBesar: boolean;
  buangSimbol: boolean;
  kpTanpaSengkang: boolean;
  sambungan: "csv" | "txt";
  nota?: string;
};

export const LABEL_MEDAN: Record<MedanBank, string> = {
  nama: tr("Nama penuh (ikut kad pengenalan)"),
  no_akaun: tr("No. akaun bank"),
  bic: tr("Kod bank (SWIFT/BIC)"),
  nama_bank: tr("Nama bank"),
  amaun: tr("Amaun (gaji bersih)"),
  no_kp: tr("No. kad pengenalan"),
  jenis_id: tr("Jenis ID"),
  rujukan: tr("Rujukan bayaran"),
  keterangan: tr("Keterangan bayaran"),
  tarikh: tr("Tarikh bayaran"),
  no_pekerja: tr("No. pekerja"),
  emel: tr("E-mel pekerja"),
  tetap: tr("Teks tetap"),
};

/** Kod SWIFT/BIC bank di Malaysia (dipadankan daripada nama bank dalam profil pekerja). */
const BIC: [RegExp, string][] = [
  [/maybank|malayan banking/i, "MBBEMYKL"],
  [/cimb/i, "CIBBMYKL"],
  [/public bank|\bpbb\b/i, "PBBEMYKL"],
  [/rhb/i, "RHBBMYKL"],
  [/hong leong/i, "HLBBMYKL"],
  [/ambank|am bank|arab.?malaysian/i, "ARBKMYKL"],
  [/bank islam/i, "BIMBMYKL"],
  [/bank rakyat|kerjasama rakyat/i, "BKRMMYKL"],
  [/simpanan nasional|\bbsn\b/i, "BSNAMYK1"],
  [/affin/i, "PHBMMYKL"],
  [/alliance/i, "MFBBMYKL"],
  [/muamalat/i, "BMMBMYKL"],
  [/agro/i, "AGOBMYKL"],
  [/mbsb/i, "AFBQMYKL"],
  [/al.?rajhi/i, "RJHIMYKL"],
  [/kuwait finance|\bkfh\b/i, "KFHOMYKL"],
  [/ocbc/i, "OCBCMYKL"],
  [/hsbc/i, "HBMBMYKL"],
  [/\buob\b|united overseas/i, "UOVBMYKL"],
  [/standard chartered/i, "SCBLMYKX"],
  [/citi/i, "CITIMYKL"],
];
export function kodBic(namaBank: string | null): string {
  if (!namaBank) return "";
  return BIC.find(([re]) => re.test(namaBank))?.[1] ?? "";
}

const asas = { pemisah: "," as const, kepala: true, hurufBesar: false, buangSimbol: false, kpTanpaSengkang: false, sambungan: "csv" as const };

/** Pratetap — semak dengan templat terkini yang dimuat turun daripada portal bank anda. */
export const PRATETAP: FormatBank[] = [
  {
    ...asas,
    id: "umum",
    nama: tr("Umum (CSV)"),
    tarikh: "DD/MM/YYYY",
    amaun: "titik",
    columns: [
      { medan: "nama", tajuk: "Nama" },
      { medan: "no_akaun", tajuk: "No. Akaun" },
      { medan: "nama_bank", tajuk: "Bank" },
      { medan: "bic", tajuk: "Kod Bank" },
      { medan: "amaun", tajuk: "Jumlah" },
      { medan: "rujukan", tajuk: "Rujukan" },
    ],
  },
  {
    ...asas,
    id: "maybank",
    nama: tr("Maybank2u Biz — Bulk Payment"),
    tarikh: "DD/MM/YYYY",
    amaun: "titik",
    hurufBesar: true,
    buangSimbol: true,
    kpTanpaSengkang: true,
    nota: tr("Maybank: simpan sebagai CSV (comma delimited); tiada simbol khas seperti * ! @ # $ ( ); jenis & no. ID wajib bagi akaun Maybank; tarikh DD/MM/YYYY. Susun lajur mengikut templat Bulk Payment yang dimuat turun di M2U Biz."),
    columns: [
      { medan: "nama", tajuk: "Beneficiary Name" },
      { medan: "no_akaun", tajuk: "Beneficiary Account No" },
      { medan: "bic", tajuk: "Beneficiary Bank Code" },
      { medan: "amaun", tajuk: "Payment Amount" },
      { medan: "rujukan", tajuk: "Payment Reference" },
      { medan: "keterangan", tajuk: "Payment Description" },
      { medan: "jenis_id", tajuk: "ID Type", nilai: "NRIC" },
      { medan: "no_kp", tajuk: "ID Number" },
      { medan: "tarikh", tajuk: "Credit Date" },
      { medan: "emel", tajuk: "Beneficiary Email" },
    ],
  },
  {
    ...asas,
    id: "cimb",
    nama: tr("CIMB BizChannel — BizConverter (Payroll)"),
    tarikh: "DD/MM/YYYY",
    amaun: "titik",
    hurufBesar: true,
    kpTanpaSengkang: true,
    nota: tr("CIMB: salin lajur ini ke dalam templat Excel CIMB BizConverter (Get Template), kemudian BizConverter menjana fail TXT untuk dimuat naik di BizChannel → Bulk Payments → Payroll. Pakej BizChannel Standard/Customised diperlukan."),
    columns: [
      { medan: "nama", tajuk: "Employee Name" },
      { medan: "no_kp", tajuk: "NRIC" },
      { medan: "no_akaun", tajuk: "Account Number" },
      { medan: "nama_bank", tajuk: "Bank Name" },
      { medan: "bic", tajuk: "Bank Code" },
      { medan: "amaun", tajuk: "Net Payroll Amount" },
      { medan: "no_pekerja", tajuk: "Employee ID" },
    ],
  },
  {
    ...asas,
    id: "ibg",
    nama: tr("Bank lain — IBG / DuitNow pukal"),
    tarikh: "DD/MM/YYYY",
    amaun: "titik",
    hurufBesar: true,
    buangSimbol: true,
    kpTanpaSengkang: true,
    nota: tr("Untuk Public Bank, RHB, Hong Leong, AmBank, Bank Islam dan lain-lain: susun lajur mengikut templat pembayaran pukal portal bank anda."),
    columns: [
      { medan: "nama", tajuk: "Beneficiary Name" },
      { medan: "no_akaun", tajuk: "Account No" },
      { medan: "bic", tajuk: "Bank Code" },
      { medan: "amaun", tajuk: "Amount" },
      { medan: "no_kp", tajuk: "ID No" },
      { medan: "rujukan", tajuk: "Reference" },
      { medan: "emel", tajuk: "Email" },
    ],
  },
];

export type BarisBayaran = {
  employee_no: string;
  person_id: string;
  full_name: string;
  ic_no: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  net: number;
};
export type DataBayaran = { period_year: number; period_month: number; pay_date: string | null; rows: BarisBayaran[] };

export async function getBarisBayaran(runId: string): Promise<DataBayaran> {
  const r = must(await getSupabase().rpc("payroll_bank_rows", { p_run: runId })) as unknown as DataBayaran;
  return { ...r, rows: (r.rows ?? []).map((x) => ({ ...x, net: Number(x.net) })) };
}

export async function getFormatSyarikat(companyId: string): Promise<FormatBank | null> {
  const r = must(await getSupabase().from("companies").select("bank_file_format").eq("id", companyId).maybeSingle()) as { bank_file_format?: FormatBank | null } | null;
  return r?.bank_file_format ?? null;
}
export async function simpanFormatSyarikat(companyId: string, f: FormatBank) {
  must(await getSupabase().rpc("set_bank_file_format", { p_company: companyId, p_format: f as never }));
}

function fmtTarikh(iso: string, f: FormatBank["tarikh"]): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return f === "YYYYMMDD" ? `${y}${m}${d}` : f === "DD-MM-YYYY" ? `${d}-${m}-${y}` : f === "YYYY-MM-DD" ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
}
function fmtAmaun(n: number, f: FormatBank["amaun"]): string {
  if (f === "sen") return String(Math.round(n * 100));
  if (f === "koma_ribu") return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}

/** Nilai satu sel bagi seorang pekerja. */
export function nilaiSel(c: LajurBank, b: BarisBayaran, f: FormatBank, ctx: { tarikh: string; tempoh: string }): string {
  let v = "";
  switch (c.medan) {
    case "nama": v = b.full_name; break;
    case "no_akaun": v = (b.bank_account_no ?? "").replace(/\D/g, ""); break;
    case "bic": v = kodBic(b.bank_name); break;
    case "nama_bank": v = b.bank_name ?? ""; break;
    case "amaun": v = fmtAmaun(b.net, f.amaun); break;
    case "no_kp": v = f.kpTanpaSengkang ? (b.ic_no ?? "").replace(/\D/g, "") : (b.ic_no ?? ""); break;
    case "jenis_id": v = c.nilai || "NRIC"; break;
    case "rujukan": v = (c.nilai || "GAJI {tempoh}").replace("{tempoh}", ctx.tempoh.replace(/\D/g, "")); break;
    case "keterangan": v = (c.nilai || "GAJI {tempoh}").replace("{tempoh}", ctx.tempoh); break;
    case "tarikh": v = fmtTarikh(ctx.tarikh, f.tarikh); break;
    case "no_pekerja": v = b.employee_no; break;
    case "emel": v = b.email ?? ""; break;
    case "tetap": v = c.nilai ?? ""; break;
  }
  if (f.hurufBesar && ["nama", "rujukan", "keterangan", "nama_bank"].includes(c.medan)) v = v.toUpperCase();
  if (f.buangSimbol && ["nama", "rujukan", "keterangan", "nama_bank"].includes(c.medan)) v = v.replace(/[^\p{L}\p{N} ./-]/gu, " ").replace(/\s+/g, " ").trim();
  return v;
}

/** Masalah data yang menyebabkan bank menolak fail (akaun / kod bank / no. KP kosong). */
export function semakBaris(f: FormatBank, rows: BarisBayaran[]): { nama: string; isu: string }[] {
  const out: { nama: string; isu: string }[] = [];
  const perlu = new Set(f.columns.map((c) => c.medan));
  for (const b of rows) {
    if (!b.bank_account_no) out.push({ nama: b.full_name, isu: tr("tiada no. akaun bank") });
    if (perlu.has("bic") && !kodBic(b.bank_name)) out.push({ nama: b.full_name, isu: tr("kod bank tidak dikenali ({0})", b.bank_name || "—") });
    if (perlu.has("no_kp") && !b.ic_no) out.push({ nama: b.full_name, isu: tr("tiada no. kad pengenalan") });
  }
  return out;
}

export function binaFail(f: FormatBank, d: DataBayaran, tarikh: string): string {
  const tempoh = `${String(d.period_month).padStart(2, "0")}/${d.period_year}`;
  const esc = (v: string) => (f.pemisah === "," && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v.replace(new RegExp(`[${f.pemisah === "\t" ? "\\t" : "\\" + f.pemisah}\\n]`, "g"), " "));
  const baris = d.rows.map((b) => f.columns.map((c) => esc(nilaiSel(c, b, f, { tarikh, tempoh }))).join(f.pemisah));
  if (f.kepala) baris.unshift(f.columns.map((c) => esc(c.tajuk)).join(f.pemisah));
  return baris.join("\r\n") + "\r\n";
}

export function muatTurunFail(nama: string, isi: string, sambungan: "csv" | "txt") {
  const url = URL.createObjectURL(new Blob([isi], { type: sambungan === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
