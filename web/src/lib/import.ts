"use client";

import { tr } from "@/lib/i18n";
/** Medan yang difahami oleh import_employees. */
export type BarisImport = {
  full_name: string;
  preferred_name: string;
  phone: string;
  ic: string;
  department: string;
  position: string;
  join_date: string;
  basic: string;
  is_head: boolean;
  head_name: string;
  issues: string[];
};

type Medan = keyof Omit<BarisImport, "issues" | "is_head"> | "role";

// Padanan lajur automatik: tajuk Excel (BM / Inggeris, pelbagai ejaan) → medan
const SINONIM: [Medan, RegExp][] = [
  ["preferred_name", /(nama\s*panggilan|nickname|preferred|panggilan)/],
  ["full_name", /(nama(\s*penuh)?|full\s*name|^name$|nama\s*pekerja|employee\s*name|staff\s*name)/],
  ["phone", /(whatsapp|telefon|phone|mobile|h\/?p|no\.?\s*tel|hp)/],
  ["ic", /(kad\s*pengenalan|\bic\b|mykad|nric|no\.?\s*kp|\bkp\b|identity)/],
  ["department", /(jabatan|department|dept|bahagian|unit|team|pasukan)/],
  ["position", /(jawatan|position|designation|title|role\s*title)/],
  ["head_name", /(ketua|manager|supervisor|reporting|penyelia|head\s*name|report\s*to)/],
  ["role", /(peranan|is\s*head|ketua\s*jabatan\?|head\?)/],
  ["join_date", /(tarikh\s*(mula|masuk|lantikan)|join|start\s*date|date\s*joined|mula\s*kerja)/],
  ["basic", /(gaji(\s*pokok)?|basic|salary)/],
];

function padanLajur(tajuk: string[]): (Medan | null)[] {
  const guna = new Set<Medan>();
  return tajuk.map((t) => {
    const s = String(t ?? "").toLowerCase().trim();
    for (const [m, re] of SINONIM) {
      if (!guna.has(m) && re.test(s)) {
        guna.add(m);
        return m;
      }
    }
    return null;
  });
}

function tarikhISO(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // hh/bb/tttt (format Malaysia)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10); // nombor siri Excel
  return "";
}

function teks(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** Baca fail Excel (.xlsx) atau CSV sebagai jadual mentah. */
export async function bacaJadual(file: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return csv((await file.text()).replace(/^﻿/, ""));
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as unknown[][];
}

export { teks as teksSel, tarikhISO };

/** Baca fail Excel (.xlsx) atau CSV dan padankan lajur. */
export async function bacaFailPekerja(file: File): Promise<{ rows: BarisImport[]; mapped: string[] }> {
  const data = await bacaJadual(file);
  // baris tajuk = baris pertama yang mempunyai lajur nama
  let h = data.findIndex((r) => padanLajur(r.map(teks)).includes("full_name"));
  if (h < 0) h = 0;
  const map = padanLajur(data[h].map(teks));
  if (!map.includes("full_name")) throw new Error(tr("Lajur nama tidak ditemui. Pastikan baris pertama ialah tajuk lajur (contoh: Nama, WhatsApp, Jabatan)."));
  const out: BarisImport[] = [];
  for (const r of data.slice(h + 1)) {
    const g = (m: Medan) => {
      const i = map.indexOf(m);
      return i >= 0 ? r[i] : "";
    };
    const nama = teks(g("full_name"));
    if (!nama) continue;
    const peranan = teks(g("role")).toLowerCase();
    out.push({
      full_name: nama,
      preferred_name: teks(g("preferred_name")),
      phone: teks(g("phone")).replace(/[^\d+]/g, ""),
      ic: teks(g("ic")),
      department: teks(g("department")),
      position: teks(g("position")),
      join_date: tarikhISO(g("join_date")),
      basic: teks(g("basic")).replace(/[^\d.]/g, ""),
      is_head: /^(ya|yes|y|1|true|ketua|head)$/.test(peranan) || /ketua\s*jabatan|head\s*of/i.test(teks(g("position"))),
      head_name: teks(g("head_name")),
      issues: [],
    });
  }
  // ketua daripada lajur "ketua": tandakan orang itu sebagai ketua jabatannya
  for (const b of out) {
    if (b.head_name) {
      const k = out.find((x) => x.full_name.toLowerCase() === b.head_name.toLowerCase() || x.preferred_name.toLowerCase() === b.head_name.toLowerCase());
      if (k && k.department === b.department) k.is_head = true;
    }
  }
  const adaKetua = new Set(out.filter((b) => b.is_head && b.department).map((b) => b.department.toLowerCase()));
  for (const b of out) {
    if (!b.phone) b.issues.push("Tiada no. WhatsApp");
    if (b.department && !adaKetua.has(b.department.toLowerCase())) b.issues.push("Tiada ketua");
    if (b.ic && b.ic.replace(/\D/g, "").length !== 12) b.issues.push("No. kad pengenalan tidak lengkap");
  }
  return { rows: out, mapped: map.filter(Boolean) as string[] };
}

export function templatCSV(): string {
  return [
    tr("Nama penuh,Nama panggilan,No. WhatsApp,No. kad pengenalan,Jabatan,Jawatan,Ketua,Tarikh mula,Gaji pokok"),
    tr("SITI AMINAH BINTI ALI,Siti,0123456789,900101-14-5678,Operasi,Ketua Jabatan,,01/03/2020,4500"),
    tr("AHMAD FIRDAUS BIN RAHMAN,Firdaus,0198765432,950505-10-1234,Operasi,Eksekutif,Siti Aminah Binti Ali,15/01/2024,3000"),
  ].join("\n");
}
