import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HRBoost.io — Sistem HR percuma melalui WhatsApp",
  description: "Pekerja memohon cuti dan membuat tuntutan melalui telefon. Ketua meluluskan dengan satu balasan. Gaji dikira mengikut KWSP, PERKESO dan PCB.",
};

const CIRI = [
  ["Pusat Kelulusan berperingkat", "Ketua → HR → CEO, atau sebarang susunan. Semua permohonan di satu tempat dan selesai pada hari yang sama."],
  ["Cuti & tuntutan melalui telefon", "Hari bekerja dikira secara automatik, baki boleh disemak, dan AI mengisi borang tuntutan daripada gambar resit."],
  ["Gaji mematuhi undang-undang", "KWSP, PERKESO, SIP dan PCB dikira secara automatik. Slip gaji PDF dihantar terus ke WhatsApp pekerja."],
  ["Kehadiran bersambung", "Sambungkan mesin kehadiran sedia ada. Pekerja yang lewat terus menerima WhatsApp — HR tidak perlu menegur."],
  ["Pembantu AI di WhatsApp", "Pekerja boleh bertanya tentang baki cuti dan polisi atau memohon surat. Ketua menerima ringkasan sebelum meluluskan."],
  ["Data setiap syarikat terkunci", "HR hanya boleh melihat syarikat sendiri. Pekerja yang bekerja di dua syarikat menggunakan satu log masuk, tetapi gaji dan rekod diasingkan sepenuhnya."],
];
const LANGKAH = [
  ["Daftar syarikat", "Isi nama syarikat dan no. WhatsApp anda. Tetapan cuti, kelulusan dan tuntutan disediakan secara automatik mengikut Akta Kerja."],
  ["Import pekerja", "Muat naik senarai Excel sedia ada. Sistem akan memadankan jabatan dan ketua untuk anda semak."],
  ["Pekerja menerima jemputan", "Setiap pekerja menerima pautan di WhatsApp, mengaktifkan akaun dengan OTP, dan terus boleh memohon cuti."],
];
const PATUH = ["Akta Kerja 1955", "KWSP", "PERKESO", "SIP", "PCB / MTD", "HRDF", "Borang EA"];

// Rujukan reka bentuk: design/Homepage.dc.html
export default function Homepage() {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <nav className="mx-auto flex max-w-[1120px] items-center gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2 text-ink!">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-sm font-extrabold text-white">HR</span>
          <b className="text-lg font-extrabold">HRBoost.io</b>
        </Link>
        <span className="grow" />
        <a href="#ciri" className="hidden text-sm font-bold text-[#4A5A57]! sm:block">
          Ciri
        </a>
        <a href="#cara" className="hidden text-sm font-bold text-[#4A5A57]! sm:block">
          Cara bermula
        </a>
        <Link href="/masuk" className="flex min-h-11 items-center text-sm font-bold">
          Log masuk
        </Link>
        <Link href="/daftar" className="hidden h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-extrabold text-white! sm:flex">
          Daftar percuma
        </Link>
      </nav>

      <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 pt-6 pb-14 md:grid-cols-[1.1fr_0.9fr] md:pt-14">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-[#E3F1EE] px-3 py-1.5 text-[13px] font-extrabold text-primary">100% percuma · untuk syarikat di Malaysia</span>
          <h1 className="m-0 text-[34px] leading-[1.15] font-extrabold md:text-[48px]">Urus HR syarikat terus melalui WhatsApp.</h1>
          <p className="m-0 max-w-[560px] text-base leading-relaxed text-[#4A5A57] md:text-lg">
            Pekerja memohon cuti dan membuat tuntutan melalui telefon. Ketua meluluskan dengan satu balasan. Gaji dikira mengikut KWSP, PERKESO dan PCB. Semuanya dalam satu sistem yang mudah.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/daftar" className="flex h-[54px] items-center justify-center rounded-button bg-primary px-6 text-base font-extrabold text-white!">
              Daftar syarikat — percuma
            </Link>
            <Link href="/masuk" className="flex h-[54px] items-center justify-center rounded-button border-2 border-primary bg-surface px-6 text-base font-extrabold text-primary!">
              Saya pekerja — log masuk
            </Link>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-2.5 rounded-[28px] bg-[#E7DED3] p-4 shadow-sm" aria-label="Contoh perbualan WhatsApp">
          <div className="max-w-[88%] rounded-[14px] rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-snug">
            Terdapat permohonan yang menunggu kelulusan anda:
            <br />
            <b>Amin · Cuti Tahunan 23–28 Dis (3 hari)</b>
            <br />
            <span className="text-ai">AI: Baki mencukupi. Zulfa juga bercuti pada 24 Dis.</span>
            <br />
            Sila balas LULUS atau TOLAK &lt;sebab&gt;.
          </div>
          <div className="self-end rounded-[14px] rounded-tr-sm bg-[#D9FDD3] px-3.5 py-2.5 text-[14px] font-bold">LULUS</div>
          <div className="max-w-[88%] rounded-[14px] rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-snug">Diluluskan. Dihantar kepada HR untuk peringkat seterusnya.</div>
        </div>
      </section>

      <section className="border-y border-line-soft bg-surface">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-center gap-x-6 gap-y-2 px-5 py-5 text-sm font-bold text-[#4A5A57]">
          {PATUH.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      <section id="ciri" className="mx-auto max-w-[1120px] px-5 py-14">
        <h2 className="m-0 max-w-[680px] text-[28px] leading-tight font-extrabold md:text-[34px]">Semua urusan HR, tanpa kertas dan tanpa perlu mengejar sesiapa.</h2>
        <p className="mt-3 mb-8 max-w-[680px] text-base text-[#4A5A57]">Dibina untuk syarikat kecil dan sederhana yang memerlukan sistem yang benar-benar digunakan oleh pekerja.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {CIRI.map(([t, s]) => (
            <div key={t} className="flex flex-col gap-2 rounded-card bg-surface p-5">
              <b className="text-base font-extrabold">{t}</b>
              <span className="text-sm leading-relaxed text-[#4A5A57]">{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="cara" className="bg-surface">
        <div className="mx-auto max-w-[1120px] px-5 py-14">
          <h2 className="m-0 mb-8 text-[28px] font-extrabold md:text-[34px]">Mulakan dalam satu petang.</h2>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 p-0">
            {LANGKAH.map(([t, s], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-white">{i + 1}</span>
                <span className="flex flex-col gap-1">
                  <b className="text-base font-extrabold">{t}</b>
                  <span className="text-sm leading-relaxed text-[#4A5A57]">{s}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-14">
        <div className="flex flex-col items-center gap-4 rounded-[24px] bg-primary px-6 py-10 text-center text-white">
          <h2 className="m-0 text-[28px] font-extrabold">Sedia untuk mencuba?</h2>
          <p className="m-0 max-w-[560px] text-base opacity-90">Percuma. Tiada kad kredit. Daftar syarikat dan jemput pekerja pertama anda hari ini.</p>
          <Link href="/daftar" className="flex h-[54px] items-center rounded-button bg-white px-8 text-base font-extrabold text-primary!">
            Daftar syarikat
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-2 pb-10 text-sm text-muted">
        <span>© 2026 HRBoost.io</span>
        <span className="grow" />
        <Link href="/privasi#privasi">Notis privasi (PDPA)</Link>
        <Link href="/privasi#terma">Terma</Link>
        <Link href="/privasi#hubungi">Hubungi kami</Link>
      </footer>
    </div>
  );
}
