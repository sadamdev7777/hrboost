import { tr, trRalat, trKonteks, bahasa } from "@/lib/i18n";
// Format tarikh, masa, nombor telefon dan label (ikut bahasa antara muka, lib/i18n).
// Semua masa dipaparkan mengikut zon Asia/Kuala_Lumpur.

export const TZ = "Asia/Kuala_Lumpur";

const BULAN = [tr("Jan"), tr("Feb"), tr("Mac"), tr("Apr"), tr("Mei"), tr("Jun"), tr("Jul"), tr("Ogo"), tr("Sep"), tr("Okt"), tr("Nov"), tr("Dis")];
const BULAN_PENUH_F = [tr("Januari"), tr("Februari"), trKonteks("Mac", "March"), tr("April"), trKonteks("Mei", "May"), trKonteks("Jun", "June"), tr("Julai"), tr("Ogos"), tr("September"), tr("Oktober"), tr("November"), tr("Disember")];
const HARI = [tr("Ahd"), tr("Isn"), tr("Sel"), tr("Rab"), tr("Kha"), tr("Jum"), tr("Sab")];

/** Bahagian tarikh tempatan (Malaysia) bagi satu timestamp. */
function localParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")) % 24,
    min: Number(get("minute")),
  };
}

/** Tarikh hari ini di Malaysia, format YYYY-MM-DD. */
export function todayISO(): string {
  const t = localParts(new Date());
  return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
}

/** Tambah n hari pada tarikh YYYY-MM-DD. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Hari dalam minggu bagi YYYY-MM-DD (0 = Ahad). */
export function dow(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function ymd(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** "23 Dis" */
export function tarikh(iso: string): string {
  const { m, d } = ymd(iso);
  return `${d} ${BULAN[m - 1]}`;
}

/** "23 Disember 2026" (dokumen rasmi). */
export function tarikhPenuh(iso: string): string {
  const { y, m, d } = ymd(iso);
  return `${d} ${BULAN_PENUH_F[m - 1]} ${y}`;
}

/** "Rab, 23 Dis" */
export function hariTarikh(iso: string): string {
  return `${HARI[dow(iso.slice(0, 10))]}, ${tarikh(iso)}`;
}

/** Nama hari pendek: "Isn" */
export function hariPendek(iso: string): string {
  return HARI[dow(iso.slice(0, 10))];
}

/** Julat tarikh ringkas: "23–28 Dis", "30 Dis – 2 Jan", "6 Nov". */
export function julatTarikh(start: string, end: string): string {
  if (start === end) return tarikh(start);
  const a = ymd(start);
  const b = ymd(end);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${BULAN[a.m - 1]}`;
  return `${tarikh(start)} – ${tarikh(end)}`;
}

/** Masa 12 jam: "8:12 pg", "3:05 ptg". */
export function masa(ts: string | Date): string {
  const t = localParts(typeof ts === "string" ? new Date(ts) : ts);
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${h12}:${String(t.min).padStart(2, "0")} ${t.h < 12 ? tr("pg") : tr("ptg")}`;
}

/** Masa penuh: "6:00 petang", "9:30 pagi" (untuk ayat). */
export function masaPanjang(ts: string): string {
  const t = localParts(new Date(ts));
  return masaTeks(`${t.h}:${String(t.min).padStart(2, "0")}`);
}

/** Masa 24 jam ringkas: "9:40" */
export function masaRingkas(ts: string): string {
  const t = localParts(new Date(ts));
  return `${t.h}:${String(t.min).padStart(2, "0")}`;
}

/** "6:00 petang" daripada "18:00:00" */
export function masaTeks(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (bahasa() !== "ms") return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  const bhg = h < 12 ? tr("pagi") : h < 14 ? tr("tengah hari") : h < 19 ? tr("petang") : tr("malam");
  return `${h12}:${String(m).padStart(2, "0")} ${bhg}`;
}

/** Tarikh tempatan (YYYY-MM-DD) bagi satu timestamp. */
export function tarikhTempatan(ts: string): string {
  const t = localParts(new Date(ts));
  return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
}

/** "hari ini", "semalam" atau "5 Nov". */
export function bilaDihantar(ts: string): string {
  const d = tarikhTempatan(ts);
  const today = todayISO();
  if (d === today) return tr("hari ini");
  if (d === addDays(today, -1)) return tr("semalam");
  return tarikh(d);
}

/** Ucapan ikut masa: Selamat pagi / tengah hari / petang / malam. */
export function ucapan(): string {
  const h = localParts(new Date()).h;
  if (h < 12) return tr("Selamat pagi,");
  if (h < 14) return tr("Selamat tengah hari,");
  if (h < 19) return tr("Selamat petang,");
  return tr("Selamat malam,");
}

/** Nombor hari: 3 → "3", 0.5 → "0.5" */
export function hari(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** RM 1,250.00 */
export function ringgit(n: number | null | undefined): string {
  return "RM " + Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Huruf awal untuk avatar: "Amin" → "AM", "Nurin Syafiqah" → "NS". */
export function inisial(nama: string | null | undefined): string {
  const s = (nama ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// ---------------- Nombor telefon Malaysia ----------------

/** Digit tempatan tanpa 0/60 di hadapan: "011-2345 6789" → "1123456789". */
export function digitTempatan(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("60")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Nombor penuh untuk Supabase Auth: "60" + digit tempatan. */
export function telefonPenuh(input: string): string | null {
  const d = digitTempatan(input);
  if (!/^1\d{8,9}$/.test(d)) return null;
  return "60" + d;
}

/** Paparan: "+60 11-2345 6789" */
export function paparTelefon(full: string): string {
  const d = digitTempatan(full);
  if (d.length === 10) return `+60 ${d.slice(0, 2)}-${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.length === 9) return `+60 ${d.slice(0, 2)}-${d.slice(2, 5)} ${d.slice(5)}`;
  return `+60 ${d}`;
}

// ---------------- Label status & peringkat ----------------

export type StatusPermohonan = "draft" | "pending" | "approved" | "rejected" | "returned" | "cancelled";

export const LABEL_STATUS: Record<StatusPermohonan, string> = {
  draft: tr("Draf"),
  pending: tr("Menunggu"),
  approved: trKonteks("Lulus", "Approved"),
  rejected: tr("Ditolak"),
  returned: tr("Dikembalikan"),
  cancelled: tr("Dibatalkan"),
};

/** Nama peringkat dalam bahasa Melayu (aliran lalai menggunakan "Finance"). */
export function namaPeringkat(nama: string): string {
  const peta: Record<string, string> = { Finance: tr("Kewangan") };
  return peta[nama] ?? trRalat(nama);
}

/** Jam 24 jam waktu Malaysia: "9:05", "18:20" (jadual kehadiran). */
export function jam(ts: string | Date): string {
  const t = localParts(typeof ts === "string" ? new Date(ts) : ts);
  return `${t.h}:${String(t.min).padStart(2, "0")}`;
}
