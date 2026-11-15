"use client";

import { bahasa, tetapkanBahasa, tr, trKonteks, type Bahasa } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Kalkulator } from "@/components/laman/Kalkulator";
import { TabSkrin } from "@/components/laman/TabSkrin";
import { BENDERA, HUBUNGI } from "@/lib/laman";

// Rujukan reka bentuk: design/HomepageV2.dc.html (telefon < 700px, komputer ≥ 980px)

// Fungsi (bukan pemalar) supaya teks mengikut bahasa semasa
const ALIRAN = () => [
  [tr("Pekerja memohon"), tr("Melalui telefon. Hari bekerja dan baki cuti dikira secara automatik.")],
  [tr("Ketua meluluskan"), tr("Dimaklumkan melalui e-mel dan pemberitahuan dalam aplikasi, kemudian meluluskan dengan satu sentuhan.")],
  [tr("HR dan CEO meluluskan"), tr("Mengikut susunan yang ditetapkan syarikat. Peringatan dihantar jika permohonan tertangguh.")],
  [tr("Rekod dan gaji dikemas kini"), tr("Baki cuti dikemas kini dan tuntutan dibayar bersama gaji.")],
];
/** Jenis surat yang dijana oleh hr_issue_letter (memo pendahuluan gaji ialah dalaman, tidak disenaraikan) */
const SURAT = () => [
  tr("Surat tawaran"),
  tr("Pengesahan jawatan"),
  tr("Lanjutan percubaan"),
  tr("Kenaikan gaji"),
  tr("Pengalaman kerja"),
  tr("Terima peletakan jawatan"),
  tr("Amaran"),
  tr("Tunjuk sebab"),
];
const PERINGATAN = () => [
  [tr("Hari gaji"), tr("mengikut tetapan syarikat")],
  [tr("KWSP, PERKESO, SIP, PCB"), tr("15hb setiap bulan")],
  [tr("Borang EA"), tr("28 Februari")],
  [tr("Borang E"), tr("31 Mac")],
];
const DEMO = () => [
  [tr("Sebagai pekerja"), tr("Mohon cuti, buat tuntutan, lihat slip gaji.")],
  [tr("Sebagai ketua"), tr("Luluskan atau tolak permohonan pasukan.")],
  [tr("Sebagai pemilik / pentadbir"), tr("Papan Pemuka, gaji dan tetapan syarikat.")],
];
const MODUL = () => [
  tr("Cuti & kalendar pasukan"),
  tr("Tuntutan perbelanjaan"),
  tr("Kehadiran"),
  tr("Gaji & caruman berkanun"),
  tr("Borang EA & Borang E"),
  tr("Kelulusan berbilang peringkat"),
  tr("Orientasi pekerja baharu"),
  tr("Pekerja & carta organisasi"),
  tr("Inventori syarikat"),
  tr("Penilaian prestasi & KPI"),
  tr("Peti HR & Pembantu AI"),
  tr("Surat HR dijana automatik"),
  tr("Sambungan AI (MCP)"),
];
const ALAT = () => [
  [tr("Kalkulator gaji bersih"), tr("Kira KWSP, PERKESO, SIP dan PCB bagi sesuatu gaji.")],
  [tr("Surat tawaran kerja"), tr("Isi borang ringkas dan muat turun sebagai PDF.")],
  [tr("Templat polisi cuti"), tr("Mematuhi had minimum Akta Kerja 1955.")],
  [tr("Buku panduan pekerja"), tr("Templat yang boleh diubah suai.")],
];
const SOALAN = () => [
  [tr("Saya tiada pegawai HR. Bolehkah saya menggunakan HRBoost?"), tr("Boleh. HRBoost dibina untuk syarikat 5–50 pekerja yang menguruskan HR sendiri. Tetapan cuti, kelulusan dan tuntutan disediakan mengikut Akta Kerja, dan kadar berkanun dikemas kini secara automatik.")],
  [tr("Adakah HRBoost benar-benar percuma?"), tr("Ya. Daftar syarikat, jemput pekerja dan gunakan semua modul tanpa bayaran dan tanpa kad kredit.")],
  [tr("Adakah data pekerja selamat?"), tr("Setiap syarikat diasingkan sepenuhnya. Hanya HR syarikat anda boleh melihat data peribadi, dan setiap akses direkodkan.")],
  [tr("Perlukah pekerja memasang aplikasi?"), tr("Tidak. Pekerja membuka pautan jemputan dan terus menggunakan pelayar telefon. Aplikasi juga boleh dipasang pada skrin utama telefon jika dikehendaki.")],
  [tr("Adakah kiraan KWSP, PERKESO dan PCB tepat?"), tr("Kadar berkanun dikemas kini oleh HRBoost. Semak slip gaji pertama dengan kalkulator rasmi sebelum membayar.")],
  [tr("Bolehkah saya menggunakan mesin kehadiran sedia ada?"), tr("Ya. Mesin kehadiran CrossChex Cloud boleh disambungkan, dan rekod diterima setiap 5 minit.")],
  [tr("Bolehkah saya mengeksport data saya?"), tr("Ya. Data boleh dieksport dalam format CSV atau Excel pada bila-bila masa.")],
];

const BALUT = "mx-auto box-border w-full max-w-[1080px] px-4 min-[700px]:px-6";
const H2 = "m-0 text-[23px] leading-[1.15] font-extrabold tracking-[-0.015em] min-[700px]:text-[28px] min-[980px]:text-[36px]";
const SEKSYEN = "pt-14 min-[700px]:pt-24";
const SEKSYEN_BESAR = "pt-14 min-[700px]:pt-28";
const KAD = "flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-[#E2E8E6] p-3.5 min-[700px]:p-5";
const TAJUK_KAD = "text-[15px] font-extrabold min-[700px]:text-base";
const TEKS_KAD = "text-[13px] leading-normal text-[#5B6B68] min-[700px]:text-sm";

export default function Kandungan() {
  return (
    <div className="min-h-dvh bg-white text-ink">
      <Pengepala />
      <main>
        <Hero />

        {/* 3. Aliran permohonan */}
        <section className="bg-[#F4F6F5]">
          <div className={`${BALUT} py-12 min-[700px]:py-[88px]`}>
            <h2 className={`${H2} mb-6 max-w-[640px] min-[700px]:mb-12`}>{tr("Satu aliran untuk setiap permohonan.")}</h2>
            <ol className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 min-[700px]:gap-7 min-[980px]:grid-cols-4">
              {ALIRAN().map(([t, s], k) => (
                <li key={t} className={`flex flex-col gap-2 border-t-2 pt-4 ${k === 0 ? "border-primary" : "border-[#C9D3D1]"}`}>
                  <span className="text-[13px] font-extrabold text-primary">{String(k + 1).padStart(2, "0")}</span>
                  <b className="text-base font-extrabold min-[700px]:text-[17px]">{t}</b>
                  <span className="text-sm leading-normal text-[#5B6B68] min-[700px]:text-[15px]">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Kelebihan */}
        <section className={`${BALUT} ${SEKSYEN}`}>
          <h2 className={`${H2} mb-2.5 max-w-[680px]`}>{tr("Kelebihan yang jarang ada pada sistem HR lain.")}</h2>
          <p className="m-0 mb-8 max-w-[580px] text-base leading-relaxed text-[#5B6B68]">
            {tr("Dibina untuk syarikat yang tiada pegawai HR — sistem yang melaksanakan kerja, bukan sekadar menyimpan rekod.")}
          </p>
          <div className="grid gap-3.5 min-[980px]:grid-cols-3">
            <KadKelebihan label={tr("AI · MCP")} tajuk={tr("Sambungkan dengan Claude melalui MCP.")} teks={tr("Tanya Claude tentang syarikat anda dalam bahasa harian. Claude bertindak bagi pihak anda, dengan kebenaran yang sama seperti anda dalam aplikasi.")}>
              <div className="mt-auto flex flex-col gap-2 rounded-[14px] bg-[#F3F0FC] p-3.5">
                <span className="max-w-[85%] self-end rounded-[12px_4px_12px_12px] bg-white px-3 py-2 text-[13px]">{tr("Siapa bercuti minggu ini?")}</span>
                <span className="max-w-[90%] self-start rounded-[4px_12px_12px_12px] bg-white px-3 py-2 text-[13px] leading-snug text-[#2E2650]">
                  {tr("Zulfa (24 Dis) dan Amin (23–28 Dis). 2 permohonan lagi menunggu kelulusan anda.")}
                </span>
              </div>
              <span className="text-xs leading-normal text-[#5B6B68]">{tr("Butiran kad pengenalan, akaun bank dan gaji individu tidak dikongsi. Setiap panggilan direkodkan.")}</span>
            </KadKelebihan>
            <KadKelebihan label={tr("SURAT HR")} tajuk={tr("Surat rasmi dijana dalam beberapa saat.")} teks={tr("Pilih pekerja dan jenis surat. Butiran diisi secara automatik daripada rekod pekerja, menggunakan kepala surat syarikat, dan sedia untuk dimuat turun sebagai PDF atau dikongsi.")}>
              <ul className="m-0 mt-auto flex list-none flex-wrap gap-1.5 p-0" aria-label={tr("Jenis surat")}>
                {SURAT().map((s) => (
                  <li key={s} className="rounded-lg bg-[#F4F6F5] px-2.5 py-[5px] text-xs font-bold text-[#33433F]">
                    {s}
                  </li>
                ))}
              </ul>
            </KadKelebihan>
            <KadKelebihan label={tr("PERINGATAN")} tajuk={tr("Hari gaji dan tarikh akhir bayaran tidak akan terlepas.")} teks={tr("HR dan Kewangan diingatkan 5 hari dan 1 hari sebelum setiap tarikh penting.")}>
              <dl className="m-0 mt-auto flex flex-col">
                {PERINGATAN().map(([k, v], i, a) => (
                  <div key={k} className={`flex justify-between gap-2.5 py-[9px] text-[13px] ${i < a.length - 1 ? "border-b border-[#EEF2F1]" : ""}`}>
                    <dt className="font-bold">{k}</dt>
                    <dd className="m-0 text-right text-[#5B6B68]">{v}</dd>
                  </div>
                ))}
              </dl>
            </KadKelebihan>
          </div>
        </section>

        {/* 5. Demo — disembunyikan sehingga syarikat demo tersedia */}
        {BENDERA.demo && (
          <section id="demo" className={`${BALUT} ${SEKSYEN} scroll-mt-20`}>
            <h2 className={`${H2} mb-2.5 max-w-[640px]`}>{tr("Cuba dahulu, tanpa perlu mendaftar.")}</h2>
            <p className="m-0 mb-8 max-w-[560px] text-base leading-relaxed text-[#5B6B68]">{tr("Buka syarikat contoh dan cuba sendiri: mohon cuti sebagai pekerja, kemudian luluskannya sebagai ketua.")}</p>
            <div className="grid grid-cols-2 gap-3 min-[980px]:grid-cols-4">
              {DEMO().map(([t, s]) => (
                <Link key={t} href="/demo" className={`${KAD} text-ink!`}>
                  <b className={TAJUK_KAD}>{t}</b>
                  <span className={TEKS_KAD}>{s}</span>
                  <span className="mt-1.5 text-sm font-bold text-primary">{tr("Buka demo ›")}</span>
                </Link>
              ))}
              <div className="flex flex-col justify-center gap-1.5 rounded-2xl bg-[#F4F6F5] p-3.5 min-[700px]:p-5">
                <b className="text-[15px] font-extrabold">{tr("± 30 saat")}</b>
                <span className={TEKS_KAD}>{tr("Data contoh sahaja. Ditetapkan semula setiap hari.")}</span>
              </div>
            </div>
          </section>
        )}

        {/* 6. Kalkulator penjimatan */}
        <section className={`${BALUT} ${SEKSYEN}`}>
          <Kalkulator />
        </section>

        {/* 7. Skrin sebenar */}
        <section id="ciri" className={`${BALUT} ${SEKSYEN} scroll-mt-20`}>
          <TabSkrin />
        </section>

        {/* 8. Modul */}
        <section className={`${BALUT} ${SEKSYEN_BESAR}`}>
          <h2 className={`${H2} mb-8 max-w-[640px]`}>{tr("Semua modul HR, dalam satu sistem.")}</h2>
          <ul className="m-0 grid list-none gap-x-10 p-0 min-[700px]:grid-cols-2 min-[980px]:grid-cols-3">
            {MODUL().map((m, k) => (
              <li key={m} className="flex min-h-11 items-center gap-3 border-b border-[#EEF2F1] text-sm font-semibold min-[700px]:min-h-[52px] min-[700px]:text-[15px]">
                <span className="w-5 shrink-0 text-xs font-bold text-[#5B6B68] tabular-nums">{String(k + 1).padStart(2, "0")}</span>
                {m}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-7 text-sm text-[#5B6B68]">{tr("Patuh Akta Kerja 1955, KWSP, PERKESO, SIP, PCB, HRDF, Borang EA dan PDPA.")}</p>
        </section>

        {/* 9. Alat percuma — disembunyikan sehingga alat tersedia */}
        {BENDERA.alatPercuma && (
          <section id="alat" className={`${BALUT} ${SEKSYEN_BESAR} scroll-mt-20`}>
            <h2 className={`${H2} mb-2.5`}>{tr("Alat HR percuma tanpa perlu log masuk.")}</h2>
            <p className="m-0 mb-7 max-w-[560px] text-base leading-relaxed text-[#5B6B68]">{tr("Untuk syarikat yang menguruskan HR sendiri.")}</p>
            <div className="grid grid-cols-2 gap-3 min-[980px]:grid-cols-4">
              {ALAT().map(([t, s]) => (
                <Link key={t} href="/alat" className={`${KAD} text-ink!`}>
                  <b className={TAJUK_KAD}>{t}</b>
                  <span className={TEKS_KAD}>{s}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 10. Cara bermula */}
        <section id="cara" className={`${BALUT} ${SEKSYEN_BESAR} scroll-mt-20`}>
          <div className="flex flex-col gap-5 rounded-[20px] bg-[#F4F6F5] px-[18px] py-6 min-[700px]:rounded-[24px] min-[700px]:px-8 min-[700px]:py-10">
            <h2 className={H2}>{tr("Mulakan dalam satu petang.")}</h2>
            <ol className="m-0 flex flex-col gap-2.5 pl-[22px] text-base leading-normal text-[#33433F]">
              <li>
                <b>{tr("Daftar syarikat")}</b> {tr("dan sahkan e-mel. Tetapan asas disediakan mengikut Akta Kerja.")}
              </li>
              <li>
                <b>{tr("Muat naik senarai pekerja")}</b> {tr("dalam fail Excel sedia ada. Sistem akan memadankan jabatan dan ketua.")}
              </li>
              <li>
                <b>{tr("Pekerja menerima pautan jemputan")}</b> {tr("melalui WhatsApp atau e-mel, dan boleh terus memohon cuti.")}
              </li>
            </ol>
            <span className="text-sm text-[#5B6B68]">{tr("Percuma sepenuhnya. Setiap syarikat diasingkan dan setiap akses kepada data peribadi direkodkan.")}</span>
          </div>
        </section>

        {/* 11. Soalan lazim */}
        <section id="soalan" className={`${BALUT} ${SEKSYEN_BESAR} scroll-mt-20`}>
          <h2 className={`${H2} mb-4`}>{tr("Soalan lazim")}</h2>
          <div className="grid gap-x-12 min-[980px]:grid-cols-2">
            {SOALAN().map(([q, a]) => (
              <details key={q} className="group border-b border-[#EEF2F1] py-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold min-[700px]:min-h-[52px] min-[700px]:text-base [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="text-xl font-normal text-[#5B6B68] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="m-0 mb-3.5 text-[15px] leading-relaxed text-[#5B6B68]">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 12. Seruan akhir */}
        <section className={`${BALUT} flex flex-col items-center gap-5 pt-16 pb-10 text-center min-[700px]:py-32`}>
          <h2 className={H2}>{tr("Sedia untuk mencuba?")}</h2>
          <p className="m-0 text-base text-[#5B6B68]">{tr("Percuma. Tiada kad kredit.")}</p>
          <Link href="/daftar" className="flex h-[52px] items-center rounded-xl bg-primary px-7 text-base font-bold text-white!">
            {tr("Daftar syarikat")}
          </Link>
          <span className="text-[13px] text-[#5B6B68]">
            {tr("Pekerja? Gunakan pautan jemputan daripada HR, atau")}{" "}
            <Link href="/masuk" className="inline-flex min-h-11 items-center font-bold">
              {tr("log masuk")}
            </Link>
            .
          </span>
        </section>
      </main>
      <KakiHalaman />
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="flex size-[30px] items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-white">
        HR
      </span>
      <b className="text-[17px] font-extrabold text-ink">HRBoost.io</b>
    </span>
  );
}

function Pengepala() {
  const pautan = "flex h-11 items-center px-3 text-sm font-semibold text-[#5B6B68]!";
  return (
    <header className="sticky top-0 z-20 border-b border-[#EEF2F1] bg-white/95 backdrop-blur">
      <nav aria-label={tr("Menu utama")} className={`${BALUT} flex h-16 items-center gap-2`}>
        <Link href="/" aria-label="HRBoost.io" className="flex min-h-11 items-center">
          <Logo />
        </Link>
        <div className="ml-6 hidden min-[980px]:flex">
          <a href="#ciri" className={pautan}>
            {tr("Ciri")}
          </a>
          <a href="#cara" className={pautan}>
            {tr("Cara bermula")}
          </a>
          <a href="#soalan" className={pautan}>
            {trKonteks("Soalan lazim", "FAQ")}
          </a>
        </div>
        <span className="grow" />
        <Link href="/masuk" className="flex h-11 items-center px-2.5 text-sm font-bold text-ink!">
          {tr("Log masuk")}
        </Link>
        <Link href="/daftar" className="flex h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-bold text-white!">
          {tr("Daftar")}
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className={`${BALUT} grid items-center gap-7 pt-7 pb-12 min-[700px]:gap-14 min-[700px]:pt-[72px] min-[700px]:pb-24 min-[980px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]`}>
      <div className="flex flex-col gap-6">
        <span className="text-sm font-bold text-primary">{tr("Untuk syarikat 5–50 pekerja tanpa pegawai HR")}</span>
        <h1 className="m-0 text-[31px] leading-[1.08] font-extrabold tracking-[-0.025em] min-[700px]:text-[38px] min-[980px]:text-[56px]">{tr("Urusan HR yang lengkap, tanpa pegawai HR.")}</h1>
        <p className="m-0 max-w-[500px] text-base leading-relaxed text-[#5B6B68] min-[700px]:text-lg">
          {tr("Cuti, tuntutan, kehadiran dan gaji diuruskan dalam satu sistem. Pekerja memohon melalui telefon, ketua meluluskan dengan satu sentuhan, dan gaji dikira mengikut KWSP, PERKESO dan PCB. Percuma.")}
        </p>
        <div className="mt-2 flex flex-col gap-3 min-[700px]:flex-row">
          <Link href="/daftar" className="flex h-12 items-center justify-center rounded-xl bg-primary px-[26px] text-[15px] font-bold text-white! min-[700px]:h-[52px] min-[700px]:text-base">
            {tr("Daftar syarikat — percuma")}
          </Link>
          {BENDERA.demo && (
            <a href="#demo" className="box-border flex h-12 items-center justify-center rounded-xl border-[1.5px] border-[#C9D3D1] px-6 text-[15px] font-bold text-ink! min-[700px]:h-[52px] min-[700px]:text-base">
              {tr("Cuba demo dahulu")}
            </a>
          )}
        </div>
        <span className="text-[13px] text-[#5B6B68]">{tr("Tiada kad kredit · Sedia digunakan dalam satu petang")}</span>
      </div>
      <div className="relative flex justify-center">
        <div className="w-[200px] overflow-hidden rounded-[30px] border-[6px] border-ink bg-ink min-[700px]:w-[260px] min-[700px]:rounded-[38px] min-[700px]:border-8">
          <Image
            src={`/skrin/${bahasa()}/ketua-kelulusan.webp`}
            alt={tr("Skrin kelulusan tuntutan: aliran Ketua Jabatan, Kewangan dan CEO")}
            width={780}
            height={1560}
            priority
            sizes="260px"
            className="block w-full rounded-[24px] min-[700px]:rounded-[30px]"
          />
        </div>
        <div className="absolute bottom-10 left-0 flex items-center gap-2.5 rounded-[14px] border border-[#E2E8E6] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(20,33,31,0.08)]">
          <span aria-hidden="true" className="flex size-[26px] items-center justify-center rounded-full bg-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <span className="flex flex-col">
            <b className="text-[13px]">{tr("Diluluskan")}</b>
            <span className="text-xs text-[#5B6B68]">{tr("Ketua Jabatan · 9:14 pg")}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function KadKelebihan({ label, tajuk, teks, children }: { label: string; tajuk: string; teks: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-[#E2E8E6] bg-white px-[18px] py-6 min-[700px]:p-6">
      <span className="text-xs font-extrabold tracking-[0.08em] text-primary">{label}</span>
      <h3 className="m-0 text-[19px] leading-snug font-extrabold">{tajuk}</h3>
      <p className="m-0 text-sm leading-relaxed text-[#5B6B68]">{teks}</p>
      {children}
    </div>
  );
}

function SuisBahasa() {
  const semasa = useSyncExternalStore(
    () => () => {},
    () => bahasa(),
    () => "en" as Bahasa,
  );
  const pilihan: [Bahasa, string, string][] = [
    ["ms", "BM", "Bahasa Melayu"],
    ["en", "EN", "English"],
  ];
  return (
    <span role="group" aria-label="Bahasa / Language" className="flex rounded-[10px] border border-[#E2E8E6] bg-white p-[3px]">
      {pilihan.map(([b, pendek, penuh]) => (
        <button
          key={b}
          type="button"
          lang={b}
          aria-label={penuh}
          aria-pressed={semasa === b}
          onClick={() => semasa !== b && tetapkanBahasa(b)}
          className={`h-11 rounded-lg px-3.5 text-xs font-bold ${semasa === b ? "bg-primary text-white" : "text-[#5B6B68]"}`}
        >
          {pendek}
        </button>
      ))}
    </span>
  );
}

function KakiHalaman() {
  const pautan = "flex min-h-11 items-center text-sm text-[#5B6B68]!";
  const tajuk = "m-0 mb-1.5 text-xs font-extrabold tracking-[0.08em] text-ink";
  return (
    <footer className="border-t border-[#E2E8E6] bg-[#F4F6F5]">
      <div className={`${BALUT} grid gap-8 pt-11 pb-8 min-[980px]:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]`}>
        <div className="flex flex-col gap-3.5">
          <Logo />
          <p className="m-0 max-w-[320px] text-sm leading-relaxed text-[#5B6B68]">{tr("Sistem HR percuma untuk syarikat 5–50 pekerja di Malaysia yang tiada pegawai HR.")}</p>
          <div className="flex flex-wrap gap-2">
            <a href={HUBUNGI.waUrl} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E8E6] bg-white px-3.5 text-[13px] font-bold text-ink!">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6B5F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
              </svg>
              <span>
                <span className="sr-only">WhatsApp </span>
                {HUBUNGI.whatsapp}
              </span>
            </a>
            <a href={`mailto:${HUBUNGI.emel}`} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E8E6] bg-white px-3.5 text-[13px] font-bold text-ink!">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6B5F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
              {HUBUNGI.emel}
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[700px]:grid-cols-3">
          <nav aria-label={tr("Produk")} className="flex flex-col">
            <h2 className={tajuk}>{tr("PRODUK")}</h2>
            <a href="#ciri" className={pautan}>
              {tr("Ciri")}
            </a>
            {BENDERA.demo && (
              <a href="#demo" className={pautan}>
                {tr("Cuba demo")}
              </a>
            )}
            <a href="#cara" className={pautan}>
              {tr("Cara bermula")}
            </a>
            <a href="#soalan" className={pautan}>
              {tr("Soalan lazim")}
            </a>
          </nav>
          {BENDERA.alatPercuma && (
            <nav aria-label={tr("Alat percuma")} className="flex flex-col">
              <h2 className={tajuk}>{tr("ALAT PERCUMA")}</h2>
              {ALAT()
                .slice(0, 3)
                .map(([t]) => (
                  <a key={t} href="#alat" className={pautan}>
                    {t}
                  </a>
                ))}
            </nav>
          )}
          <nav aria-label={tr("Undang-undang")} className="flex flex-col">
            <h2 className={tajuk}>{tr("UNDANG-UNDANG")}</h2>
            <Link href="/privasi#privasi" className={pautan}>
              {tr("Notis privasi (PDPA)")}
            </Link>
            <Link href="/privasi#terma" className={pautan}>
              {tr("Terma")}
            </Link>
          </nav>
        </div>
      </div>
      <div className={`${BALUT} flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E6] pt-4 pb-6 text-[13px] text-[#5B6B68]`}>
        <span>{tr("© {0} HRBoost.io · Dibina di Malaysia", "2026")}</span>
        <SuisBahasa />
      </div>
    </footer>
  );
}
