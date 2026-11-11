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
  return tunggal(isi(EN[ms] ?? ms, v));
}

// "1 days" → "1 day" (kamus English menggunakan bentuk jamak bagi {0}).
const TUNGGAL: Record<string, string> = {
  days: "day", employees: "employee", requests: "request", claims: "claim", months: "month", years: "year",
  minutes: "minute", hours: "hour", items: "item", people: "person", departments: "department", weeks: "week",
  times: "time", rules: "rule", types: "type", steps: "step", levels: "level", approvers: "approver", "clock-ins": "clock-in", names: "name",
};
function tunggal(s: string): string {
  return s.replace(/(^|[^\d.,])1 (days|employees|requests|claims|months|years|minutes|hours|items|people|departments|weeks|times|rules|types|steps|levels|approvers|clock-ins|names)\b/g, (_m, a: string, w: string) => `${a}1 ${TUNGGAL[w]}`);
}
export const t = tr;

/**
 * Teks yang sama dalam BM tetapi berbeza dalam English mengikut konteks
 * (cth. "Lulus" = butang "Approve", tetapi status "Approved"). Terjemahan diberi terus.
 */
export function trKonteks(ms: string, en: string): string {
  return bahasa() === "ms" ? ms : en;
}

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
      return p.en.replace(/\[%\]|%/g, (t) => {
        if (t === "[%]") return "%";
        const v = x[i++] ?? "";
        return RALAT[v] ?? EN[v] ?? v; // nilai seperti nama jenis cuti turut diterjemah
      });
    }
  }
  return m;
}

// ---------------------------------------------------------------- Tajuk permohonan
// Tajuk permohonan dijana oleh pangkalan data dalam BM (cth. "Cuti Tahunan 24 – 25 Dis",
// "Tuntutan: Tol (RM 88.40)", "Kerja lebih masa 3 jam · 9 Nov"). Dalam mod English, awalan
// dan nama bulan diterjemah; nama jenis cuti dicari dalam kamus.
const BULAN_EN: Record<string, string> = { Mac: "Mar", Mei: "May", Ogo: "Aug", Okt: "Oct", Dis: "Dec" };
const AWALAN: [RegExp, string][] = [
  [/^Tuntutan: /, "Claim: "],
  [/^Tuntutan /, "Claim "],
  [/^Pembetulan kehadiran /, "Time correction "],
  [/^Betulkan masa /, "Time correction "],
  [/^Kerja lebih masa ([\d.,]+) jam/, "Overtime $1 hours"],
  [/^Pendahuluan gaji /, "Salary advance "],
  [/^Penilaian percubaan /, "Probation review "],
  [/^Kemas kini profil: /, "Profile update: "],
];

export function trTajuk(t: string): string {
  if (bahasa() === "ms" || !t) return t;
  let x = t;
  let ganti = false;
  for (const [re, en] of AWALAN) {
    if (re.test(x)) {
      x = x.replace(re, en);
      ganti = true;
      break;
    }
  }
  if (!ganti) {
    // awalan terpanjang yang ada dalam kamus (nama jenis cuti)
    const w = x.split(" ");
    for (let n = Math.min(4, w.length); n >= 1; n--) {
      const k = w.slice(0, n).join(" ");
      const en = RALAT[k] ?? EN[k];
      if (en) {
        x = [en, ...w.slice(n)].join(" ");
        break;
      }
    }
  }
  return x
    .replace(/\((\d+(?:\.\d+)?) hari\)/g, (_m, n: string) => `(${n} ${n === "1" ? "day" : "days"})`)
    .replace(/\b(Mac|Mei|Ogo|Okt|Dis)\b/g, (m) => BULAN_EN[m] ?? m);
}

