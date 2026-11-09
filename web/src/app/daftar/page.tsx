"use client";

import { Langkah } from "@/components/LangkahDaftar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { telefonPenuh } from "@/lib/format";
import { simpanPendaftaran } from "@/lib/daftar";
import { IconBack } from "@/components/icons";

const SAIZ = ["1–10", "11–50", "51–200", "200+"];
const input = "h-12 rounded-field border border-line bg-surface px-4 text-base font-semibold text-ink outline-none focus:border-primary aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft";

// Rujukan reka bentuk: design/DaftarSyarikat.dc.html
export default function DaftarSyarikatPage() {
  const router = useRouter();
  const [f, setF] = useState({ company: "", size: "11–50", name: "", phone: "", email: "" });
  const [setuju, setSetuju] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalatAsal] = useState<string | null>(null);
  const [salah, setSalah] = useState<string | null>(null);
  // Ralat dipaparkan di bawah medan berkenaan (dan medan ditanda merah)
  const setRalat = (m: string | null, medan: string | null = null) => {
    setRalatAsal(m);
    setSalah(medan);
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function hantar(e: React.FormEvent) {
    e.preventDefault();
    setRalat(null);
    const phone = telefonPenuh(f.phone);
    if (!f.company.trim()) return setRalat("Sila isi nama syarikat.", "company");
    if (!f.name.trim()) return setRalat("Sila isi nama penuh anda.", "name");
    if (!phone) return setRalat("Sila masukkan nombor WhatsApp Malaysia yang sah, contohnya 012-345 6789.", "phone");
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setRalat("E-mel tidak sah.", "email");
    if (!setuju) return setRalat("Sila bersetuju dengan Terma dan Notis Privasi.", "setuju");
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithOtp({ phone, options: { channel: "sms" } });
    setBusy(false);
    if (error) return setRalat(error.status === 429 ? "Terlalu banyak cubaan. Sila tunggu sebentar." : "Kod tidak dapat dihantar. Sila cuba lagi.");
    simpanPendaftaran({ ...f, phone, company: f.company.trim(), name: f.name.trim(), email: f.email.trim() });
    router.push("/daftar/sahkan");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex items-center px-3 pt-3 pb-1">
        <Link href="/" aria-label="Kembali ke laman utama" className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
      </header>
      <form onSubmit={hantar} className="flex grow flex-col gap-4 px-6 pb-8" noValidate>
        <div className="flex flex-col gap-1.5">
          <Langkah n={1} />
          <h1 className="m-0 text-[22px] font-extrabold">Daftar syarikat</h1>
          <span className="text-sm text-subtle">Percuma dan hanya 2 minit. Anda akan menjadi Pentadbir syarikat ini.</span>
        </div>
        <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">SYARIKAT</span>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Nama syarikat
          <input className={input} value={f.company} onChange={set("company")} aria-invalid={salah === "company" || undefined} placeholder="Contoh: Syarikat ABC Sdn Bhd" autoComplete="organization" />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-bold">
          Bilangan pekerja
          <div className="grid grid-cols-4 gap-2">
            {SAIZ.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={f.size === s}
                onClick={() => setF({ ...f, size: s })}
                className={`h-11 rounded-[12px] text-sm font-bold ${f.size === s ? "border-[1.5px] border-primary bg-[#E3F1EE] text-primary" : "border border-[#D5DEDC] bg-surface"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">ANDA</span>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Nama penuh
          <input className={input} value={f.name} onChange={set("name")} aria-invalid={salah === "name" || undefined} placeholder="Nama anda" autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          No. WhatsApp
          <input className={input} type="tel" value={f.phone} onChange={set("phone")} aria-invalid={salah === "phone" || undefined} placeholder="+60 1x-xxx xxxx" autoComplete="tel" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          E-mel
          <input className={input} type="email" value={f.email} onChange={set("email")} aria-invalid={salah === "email" || undefined} placeholder="nama@syarikat.com" autoComplete="email" />
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-normal">
          <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>
            Saya bersetuju dengan <Link href="/privasi#terma">Terma</Link> dan <Link href="/privasi#privasi">Notis Privasi</Link>.
          </span>
        </label>
        {ralat && (
          <span role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
            {ralat}
          </span>
        )}
        <button type="submit" disabled={busy} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? "Menghantar…" : "Daftar & hantar kod WhatsApp"}
        </button>
        <span className="text-center text-sm text-muted">
          Sudah mempunyai akaun? <Link href="/masuk">Log masuk</Link>
        </span>
      </form>
    </div>
  );
}
