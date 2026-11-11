"use client";

import { KerangkaAwam, CIRI_DAFTAR } from "@/components/KerangkaAwam";
import { tr } from "@/lib/i18n";
import { Langkah } from "@/components/LangkahDaftar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { telefonPenuh } from "@/lib/format";
import { simpanPendaftaran } from "@/lib/daftar";
import { MedanKataLaluan } from "../masuk/MedanKataLaluan";
import { IconBack } from "@/components/icons";

const SAIZ = ["1–10", "11–50", "51–200", "200+"];
const input = "h-12 rounded-field border border-line bg-surface px-4 text-base font-semibold text-ink outline-none focus:border-primary aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft";

// Rujukan reka bentuk: design/DaftarSyarikat.dc.html
export default function DaftarSyarikatPage() {
  const router = useRouter();
  const [f, setF] = useState({ company: "", size: "11–50", name: "", phone: "", email: "" });
  const [kataLaluan, setKataLaluan] = useState("");
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
    const email = f.email.trim().toLowerCase();
    const phone = f.phone.trim() ? telefonPenuh(f.phone) : "";
    if (!f.company.trim()) return setRalat(tr("Sila isi nama syarikat."), "company");
    if (!f.name.trim()) return setRalat(tr("Sila isi nama penuh anda."), "name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setRalat(tr("Sila masukkan alamat e-mel yang sah."), "email");
    if (kataLaluan.length < 8) return setRalat(tr("Kata laluan mesti sekurang-kurangnya 8 aksara."), "password");
    if (f.phone.trim() && !phone) return setRalat(tr("Sila masukkan nombor WhatsApp Malaysia yang sah, contohnya 012-345 6789."), "phone");
    if (!setuju) return setRalat(tr("Sila bersetuju dengan Terma dan Notis Privasi."), "setuju");
    setBusy(true);
    const daftar = { company: f.company.trim(), size: f.size, name: f.name.trim(), phone: phone || "" };
    // Pautan pengesahan dalam e-mel membuka /daftar/sahkan; syarikat dicipta selepas e-mel disahkan
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: kataLaluan,
      options: { emailRedirectTo: `${window.location.origin}/daftar/sahkan`, data: { daftar } },
    });
    setBusy(false);
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return setRalat(tr("E-mel ini sudah berdaftar. Sila log masuk."), "email");
      if (/password/i.test(error.message)) return setRalat(tr("Kata laluan terlalu lemah. Gunakan sekurang-kurangnya 8 aksara dengan huruf dan nombor."), "password");
      return setRalat(error.status === 429 ? tr("Terlalu banyak cubaan. Sila tunggu sebentar.") : tr("Pendaftaran tidak berjaya. Sila cuba lagi."));
    }
    // Supabase memulangkan pengguna tanpa identiti jika e-mel telah berdaftar (tidak mendedahkan ralat)
    if (data.user && (data.user.identities ?? []).length === 0) return setRalat(tr("E-mel ini sudah berdaftar. Sila log masuk."), "email");
    simpanPendaftaran({ ...daftar, email });
    router.push("/daftar/sahkan");
  }

  return (
    <KerangkaAwam tajuk={tr("Daftar syarikat anda dalam 2 minit.")} kecil={tr("Anda akan menjadi Pentadbir syarikat dan boleh menjemput pekerja sejurus selepas itu.")} ciri={CIRI_DAFTAR()}>
    <div className="flex w-full flex-col bg-page text-ink lg:rounded-[20px] lg:bg-surface lg:py-4 lg:shadow-sm">
      <header className="flex items-center px-3 pt-3 pb-1">
        <Link href="/" aria-label={tr("Kembali ke laman utama")} className="flex size-11 items-center justify-center rounded-full text-ink!">
          <IconBack />
        </Link>
      </header>
      <form onSubmit={hantar} className="flex grow flex-col gap-4 px-6 pb-8" noValidate>
        <div className="flex flex-col gap-1.5">
          <Langkah n={1} />
          <h1 className="m-0 text-[22px] font-extrabold">{tr("Daftar syarikat")}</h1>
          <span className="text-sm text-subtle">{tr("Percuma dan hanya 2 minit. Anda akan menjadi Pentadbir syarikat ini.")}</span>
        </div>
        <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("SYARIKAT")}</span>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Nama syarikat")}<input className={input} value={f.company} onChange={set("company")} aria-invalid={salah === "company" || undefined} placeholder={tr("Contoh: Syarikat ABC Sdn Bhd")} autoComplete="organization" />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Bilangan pekerja")}<div className="grid grid-cols-4 gap-2">
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
        <span className="pt-1 text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("ANDA")}</span>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Nama penuh")}<input className={input} value={f.name} onChange={set("name")} aria-invalid={salah === "name" || undefined} placeholder={tr("Nama anda")} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("E-mel")}
          <input className={input} type="email" inputMode="email" value={f.email} onChange={set("email")} aria-invalid={salah === "email" || undefined} placeholder={tr("nama@syarikat.com")} autoComplete="email" />
          <span className="text-xs font-normal text-muted">{tr("Pautan pengesahan akan dihantar ke e-mel ini. E-mel ini digunakan untuk log masuk.")}</span>
        </label>
        <div aria-invalid={salah === "password" || undefined} className="aria-[invalid=true]:[&_input]:border-danger">
          <MedanKataLaluan label={tr("Kata laluan")} value={kataLaluan} onChange={setKataLaluan} autoComplete="new-password" bantuan={tr("Sekurang-kurangnya 8 aksara.")} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          <span>
            {tr("No. WhatsApp")} <span className="font-normal text-muted">{tr("(pilihan)")}</span>
          </span>
          <input className={input} type="tel" value={f.phone} onChange={set("phone")} aria-invalid={salah === "phone" || undefined} placeholder={tr("+60 1x-xxx xxxx")} autoComplete="tel" />
          <span className="text-xs font-normal text-muted">{tr("Untuk menerima notifikasi kelulusan melalui WhatsApp. Boleh diisi kemudian.")}</span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-normal">
          <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>
            {tr("Saya bersetuju dengan")}{" "}<Link href="/privasi#terma">{tr("Terma")}</Link> {tr("dan")} <Link href="/privasi#privasi">{tr("Notis Privasi")}</Link>.
          </span>
        </label>
        {ralat && (
          <span role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
            {ralat}
          </span>
        )}
        <button type="submit" disabled={busy} className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? tr("Menghantar…") : tr("Daftar & sahkan e-mel")}
        </button>
        <span className="text-center text-sm text-muted">
          {tr("Sudah mempunyai akaun?")}{" "}<Link href="/masuk">{tr("Log masuk")}</Link>
        </span>
      </form>
    </div>
    </KerangkaAwam>
  );
}
