/**
 * Bahasa antara muka: English (lalai) atau Bahasa Melayu.
 *
 * Teks sumber dalam kod ialah Bahasa Melayu rasmi; `tr("…")` memulangkan terjemahan English
 * daripada kamus (lib/kamus/en.ts) apabila bahasa ialah English. Pemboleh ubah ditulis {0}, {1}, …
 *
 * Keutamaan bahasa: kuki hrb_bahasa (dibaca juga oleh pelayan supaya HTML awal sepadan) → localStorage
 * → persons.language (diselaraskan selepas log masuk) → English. Menukar bahasa memuat semula halaman.
 */
import { EN } from "./kamus/en";

export type Bahasa = "en" | "ms";
const KUNCI = "hrb_bahasa";
let semasa: Bahasa | null = null;

export function bahasa(): Bahasa {
  if (semasa) return semasa;
  if (typeof window === "undefined") return "en";
  const kuki = document.cookie.match(/(?:^|; )hrb_bahasa=(en|ms)/)?.[1] as Bahasa | undefined;
  if (kuki) return (semasa = kuki);
  try {
    semasa = localStorage.getItem(KUNCI) === "ms" ? "ms" : "en";
  } catch {
    semasa = "en";
  }
  return semasa;
}

/**
 * Bahasa permintaan semasa (daripada kuki, dibaca oleh susun atur akar di pelayan).
 * Dipanggil oleh <BahasaAwal> semasa render supaya pelayan dan pelayar memapar bahasa yang sama.
 */
export function aturBahasa(b: Bahasa) {
  semasa = b;
}

/** Adakah bahasa telah dipilih secara jelas dalam pelayar ini? */
export function bahasaDipilih(): boolean {
  try {
    return !!localStorage.getItem(KUNCI) || /(?:^|; )hrb_bahasa=/.test(document.cookie);
  } catch {
    return true;
  }
}

/** Simpan pilihan bahasa dan muat semula (seluruh antara muka bertukar). */
export function tetapkanBahasa(b: Bahasa, muatSemula = true) {
  try {
    localStorage.setItem(KUNCI, b);
  } catch {
    /* storan disekat */
  }
  document.cookie = `hrb_bahasa=${b}; path=/; max-age=31536000; samesite=lax`;
  semasa = b;
  if (muatSemula) window.location.reload();
}

function isi(s: string, v: unknown[]): string {
  return v.length ? s.replace(/\{(\d+)\}/g, (m, i) => (v[Number(i)] === undefined ? m : String(v[Number(i)]))) : s;
}

/** Terjemah teks sumber Bahasa Melayu ke bahasa semasa. */
export function tr(ms: string, ...v: unknown[]): string {
  if (bahasa() === "ms") return isi(ms, v);
  return isi(EN[ms] ?? ms, v);
}
export const t = tr;

/** Bahasa untuk Intl (nombor, tarikh). */
export function lokal(): string {
  return bahasa() === "ms" ? "ms-MY" : "en-MY";
}

// ---------------------------------------------------------------- Mesej ralat pangkalan data
// Fungsi pangkalan data menghantar mesej Bahasa Melayu (raise exception '…'). Dalam mod English,
// mesej diterjemah melalui kamus ralat; mesej dengan nilai (% dalam format asal) dipadankan ikut pola.
import { RALAT } from "./kamus/ralat";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let pola: { re: RegExp; en: string }[] | null = null;

export function trRalat(m: string): string {
  if (bahasa() === "ms" || !m) return m;
  const terus = RALAT[m] ?? EN[m];
  if (terus) return terus;
  pola ??= Object.entries(RALAT)
    .filter(([k]) => k.includes("%"))
    .map(([k, en]) => ({
      // "[%]" = tanda peratus literal; "%" = nilai.
      re: new RegExp("^" + k.split("[%]").map((b) => b.split("%").map(esc).join("(.+?)")).join("%") + "$", "s"),
      en,
    }));
  for (const p of pola) {
    const x = m.match(p.re);
    if (x) {
      let i = 1;
      return p.en.replace(/\[%\]|%/g, (t) => (t === "[%]" ? "%" : (x[i++] ?? "")));
    }
  }
  return m;
}
