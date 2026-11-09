"use client";

import { tr } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { PilihBahasa } from "@/components/PilihBahasa";


// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const CIRI = () => [
  [tr("Pusat Kelulusan berperingkat"), tr("Ketua → HR → CEO, atau sebarang susunan. Semua permohonan di satu tempat dan selesai pada hari yang sama.")],
  [tr("Cuti & tuntutan melalui telefon"), tr("Hari bekerja dikira secara automatik, baki boleh disemak, dan AI mengisi borang tuntutan daripada gambar resit.")],
  [tr("Gaji mematuhi undang-undang"), tr("KWSP, PERKESO, SIP dan PCB dikira secara automatik. Slip gaji PDF dihantar terus ke WhatsApp pekerja.")],
  [tr("Kehadiran bersambung"), tr("Sambungkan mesin kehadiran sedia ada. Pekerja yang lewat terus menerima WhatsApp — HR tidak perlu menegur.")],
  [tr("Pembantu AI di WhatsApp"), tr("Pekerja boleh bertanya tentang baki cuti dan polisi atau memohon surat. Ketua menerima ringkasan sebelum meluluskan.")],
  [tr("Data setiap syarikat terkunci"), tr("HR hanya boleh melihat syarikat sendiri. Pekerja yang bekerja di dua syarikat menggunakan satu log masuk, tetapi gaji dan rekod diasingkan sepenuhnya.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const LANGKAH = () => [
  [tr("Daftar syarikat"), tr("Isi nama syarikat dan no. WhatsApp anda. Tetapan cuti, kelulusan dan tuntutan disediakan secara automatik mengikut Akta Kerja.")],
  [tr("Import pekerja"), tr("Muat naik senarai Excel sedia ada. Sistem akan memadankan jabatan dan ketua untuk anda semak.")],
  [tr("Pekerja menerima jemputan"), tr("Setiap pekerja menerima pautan di WhatsApp, mengaktifkan akaun dengan OTP, dan terus boleh memohon cuti.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const SOALAN = () => [
  [tr("Adakah HRBoost benar-benar percuma?"), tr("Ya. Daftar syarikat, jemput pekerja dan gunakan cuti, tuntutan, kelulusan, kehadiran dan gaji tanpa bayaran dan tanpa kad kredit.")],
  [tr("Adakah data pekerja selamat?"), tr("Setiap syarikat diasingkan sepenuhnya. Hanya HR syarikat anda boleh melihat kad pengenalan, akaun bank, gaji dan sijil cuti sakit, dan setiap akses direkodkan. Pentadbir platform hanya melihat jumlah keseluruhan, bukan data peribadi.")],
  [tr("Perlukah pekerja memasang aplikasi?"), tr("Tidak. Pekerja menerima pautan di WhatsApp dan boleh terus menggunakan pelayar telefon. Mereka boleh memasangnya pada skrin utama jika mahu.")],
  [tr("Bagaimana jika pekerja tiada WhatsApp?"), tr("HR boleh menyalin pautan jemputan dan menghantarnya melalui saluran lain. Pekerja kemudian log masuk dengan e-mel dan kata laluan.")],
  [tr("Bolehkah saya menggunakan mesin kehadiran sedia ada?"), tr("Ya, mesin CrossChex Cloud boleh disambungkan. Rekod masuk dan keluar diterima secara automatik setiap 5 minit.")],
  [tr("Bagaimana menghubungi pasukan HRBoost?"), tr("E-mel hi@hrboost.io atau WhatsApp 019-444 2424. Pejabat kami di D-G-6 Putra Walk, Taman Pinggiran Putra, 43300 Seri Kembangan, Selangor.")],
  [tr("Berapa lama untuk mula?"), tr("Kebanyakan syarikat siap dalam satu petang: daftar, import senarai pekerja daripada Excel, semak jabatan dan ketua, kemudian jemput pekerja.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const SKRIN = () => [
  { src: "/skrin/pekerja-utama.webp", alt: tr("Skrin utama pekerja: baki cuti, permohonan dan kehadiran"), tajuk: tr("Pekerja"), sub: tr("Baki cuti, permohonan dan kehadiran di satu skrin."), telefon: true },
  { src: "/skrin/pekerja-mohon-cuti.webp", alt: tr("Skrin mohon cuti: jenis cuti, tarikh dan pelulus"), tajuk: tr("Mohon cuti"), sub: tr("Hari bekerja dan baki dikira semasa memilih tarikh."), telefon: true },
  { src: "/skrin/hr-papan-pemuka.webp", alt: tr("Papan Pemuka HR: tindakan, kehadiran hari ini dan status gaji"), tajuk: tr("Papan Pemuka HR"), sub: tr("Semua yang perlu diuruskan hari ini, dengan butang Lulus terus."), telefon: false },
  { src: "/skrin/hr-gaji-pekerja.webp", alt: tr("Jadual Gaji Pekerja dengan KWSP, PERKESO, SIP dan gaji bersih"), tajuk: tr("Gaji pekerja"), sub: tr("KWSP, PERKESO, SIP dan PCB dikira semasa anda menaip."), telefon: false },
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const PATUH = () => [tr("Akta Kerja 1955"), tr("KWSP"), tr("PERKESO"), tr("SIP"), tr("PCB / MTD"), "HRDF", tr("Borang EA")];

// Rujukan reka bentuk: design/Homepage.dc.html
export default function Kandungan() {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <nav className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-ink!">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-sm font-extrabold text-white">HR</span>
          <b className="text-lg font-extrabold">HRBoost.io</b>
        </Link>
        <span className="grow" />
        <a href="#ciri" className="hidden text-sm font-bold text-[#4A5A57]! sm:block">
          {tr("Ciri")}</a>
        <a href="#cara" className="hidden text-sm font-bold text-[#4A5A57]! sm:block">
          {tr("Cara bermula")}</a>
        <a href="#soalan" className="hidden text-sm font-bold text-[#4A5A57]! md:block">
          {tr("Soalan lazim")}</a>
        <PilihBahasa kecil />
        <Link href="/masuk" className="flex min-h-11 items-center text-sm font-bold">
          {tr("Log masuk")}</Link>
        <Link href="/daftar" className="hidden h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-extrabold text-white! sm:flex">
          {tr("Daftar percuma")}</Link>
      </nav>

      <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 pt-4 pb-14 md:grid-cols-[1.1fr_0.9fr] md:pt-14">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-[#E3F1EE] px-3 py-1.5 text-[13px] font-extrabold text-primary">{tr("100% percuma · untuk syarikat di Malaysia")}</span>
          <h1 className="m-0 text-[34px] leading-[1.15] font-extrabold md:text-[48px]">{tr("Urus HR syarikat terus melalui WhatsApp.")}</h1>
          <p className="m-0 max-w-[560px] text-base leading-relaxed text-[#4A5A57] md:text-lg">
            {tr("Pekerja memohon cuti dan membuat tuntutan melalui telefon. Ketua meluluskan dengan satu balasan. Gaji dikira mengikut KWSP, PERKESO dan PCB. Semuanya dalam satu sistem yang mudah.")}</p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/daftar" className="flex h-12 items-center justify-center rounded-button bg-primary px-6 text-base font-extrabold text-white!">
              {tr("Daftar syarikat — percuma")}</Link>
            <Link href="/masuk" className="flex h-12 items-center justify-center rounded-button border-2 border-primary bg-surface px-6 text-base font-extrabold text-primary!">
              {tr("Saya pekerja — log masuk")}</Link>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-2.5 rounded-[28px] bg-[#E7DED3] p-4 shadow-sm" aria-label={tr("Contoh perbualan WhatsApp")}>
          <div className="max-w-[88%] rounded-[14px] rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-snug">
            {tr("Terdapat permohonan yang menunggu kelulusan anda:")}<br />
            <b>{tr("Amin · Cuti Tahunan 23–28 Dis (3 hari)")}</b>
            <br />
            <span className="text-ai">{tr("AI: Baki mencukupi. Zulfa juga bercuti pada 24 Dis.")}</span>
            <br />
            {tr("Sila balas LULUS atau TOLAK <sebab>.")}</div>
          <div className="self-end rounded-[14px] rounded-tr-sm bg-[#D9FDD3] px-3.5 py-2.5 text-[14px] font-bold">{tr("LULUS")}</div>
          <div className="max-w-[88%] rounded-[14px] rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-snug">{tr("Diluluskan. Dihantar kepada HR untuk peringkat seterusnya.")}</div>
        </div>
      </section>

      <section className="border-y border-line-soft bg-surface">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-5 text-sm font-bold text-[#4A5A57]">
          {PATUH().map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      <section id="skrin" className="mx-auto max-w-[1120px] px-4 pt-14">
        <h2 className="m-0 text-2xl leading-tight font-extrabold md:text-[34px]">{tr("Lihat sendiri.")}</h2>
        <p className="mt-3 mb-8 max-w-[680px] text-base text-[#4A5A57]">{tr("Skrin sebenar HRBoost — di telefon untuk pekerja, di komputer untuk HR. Contoh menggunakan data demo.")}</p>
        <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,0.6fr))_minmax(0,1.4fr)]">
          {SKRIN().filter((x) => x.telefon).map((x) => (
            <figure key={x.src} className="m-0 flex flex-col gap-2">
              <Image src={x.src} alt={x.alt} width={780} height={1560} sizes="(min-width: 768px) 220px, 100vw" className="w-full rounded-[22px] border-4 border-ink shadow-md" />
              <figcaption className="flex flex-col">
                <b className="text-sm">{x.tajuk}</b>
                <span className="text-[13px] text-[#4A5A57]">{x.sub}</span>
              </figcaption>
            </figure>
          ))}
          <div className="flex flex-col gap-4">
            {SKRIN().filter((x) => !x.telefon).map((x) => (
              <figure key={x.src} className="m-0 flex flex-col gap-2">
                <Image src={x.src} alt={x.alt} width={2560} height={1520} sizes="(min-width: 768px) 620px, 100vw" className="w-full rounded-[14px] border border-line shadow-md" />
                <figcaption className="flex flex-col">
                  <b className="text-sm">{x.tajuk}</b>
                  <span className="text-[13px] text-[#4A5A57]">{x.sub}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="ciri" className="mx-auto max-w-[1120px] px-4 py-14">
        <h2 className="m-0 max-w-[680px] text-2xl leading-tight font-extrabold md:text-[34px]">{tr("Semua urusan HR, tanpa kertas dan tanpa perlu mengejar sesiapa.")}</h2>
        <p className="mt-3 mb-8 max-w-[680px] text-base text-[#4A5A57]">{tr("Dibina untuk syarikat kecil dan sederhana yang memerlukan sistem yang benar-benar digunakan oleh pekerja.")}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {CIRI().map(([t, s]) => (
            <div key={t} className="flex flex-col gap-2 rounded-card bg-surface p-5">
              <b className="text-base font-extrabold">{t}</b>
              <span className="text-sm leading-relaxed text-[#4A5A57]">{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="cara" className="bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 py-14">
          <h2 className="m-0 mb-8 text-2xl font-extrabold md:text-[34px]">{tr("Mulakan dalam satu petang.")}</h2>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 p-0">
            {LANGKAH().map(([t, s], i) => (
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

      <section id="pekerja" className="mx-auto grid max-w-[1120px] gap-6 px-4 pt-14 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6">
          <h2 className="m-0 text-xl font-extrabold">{tr("Untuk pekerja")}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-[#4A5A57]">
            <li>{tr("Mohon cuti dan buat tuntutan dari telefon — ambil gambar resit, AI mengisi borang.")}</li>
            <li>{tr("Semak baki cuti, slip gaji dan kehadiran bila-bila masa.")}</li>
            <li>{tr("Terima keputusan dan slip gaji terus di WhatsApp.")}</li>
          </ul>
          <Link href="/masuk" className="self-start text-sm font-bold">
            {tr("Sudah dijemput? Log masuk ›")}</Link>
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6">
          <h2 className="m-0 text-xl font-extrabold">{tr("Untuk HR & majikan")}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-[#4A5A57]">
            <li>{tr("Semua kelulusan di satu tempat — atau terus dari WhatsApp dengan membalas LULUS.")}</li>
            <li>{tr("Gaji, KWSP, PERKESO, SIP dan PCB dikira secara automatik, termasuk fail untuk bank.")}</li>
            <li>{tr("Papan Pemuka harian: siapa tiada, siapa lewat, apa yang perlu diluluskan.")}</li>
          </ul>
          <Link href="/daftar" className="self-start text-sm font-bold">
            {tr("Daftar syarikat ›")}</Link>
        </div>
      </section>

      <section id="soalan" className="mx-auto max-w-[1120px] px-4 pt-14">
        <h2 className="m-0 mb-6 text-2xl font-extrabold md:text-[34px]">{tr("Soalan lazim")}</h2>
        <div className="flex flex-col rounded-card bg-surface px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {SOALAN().map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="text-xl text-primary transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 mb-0 text-sm leading-relaxed text-[#4A5A57]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-14">
        <div className="flex flex-col items-center gap-4 rounded-[24px] bg-primary px-6 py-10 text-center text-white">
          <h2 className="m-0 text-2xl font-extrabold">{tr("Sedia untuk mencuba?")}</h2>
          <p className="m-0 max-w-[560px] text-base opacity-90">{tr("Percuma. Tiada kad kredit. Daftar syarikat dan jemput pekerja pertama anda hari ini.")}</p>
          <Link href="/daftar" className="flex h-12 items-center rounded-button bg-white px-8 text-base font-extrabold text-primary!">
            {tr("Daftar syarikat")}</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-2 pb-10 text-sm text-muted">
        <span>{tr("© 2026 HRBoost.io")}</span>
        <span className="grow" />
        <Link href="/privasi#privasi">{tr("Notis privasi (PDPA)")}</Link>
        <Link href="/privasi#terma">{tr("Terma")}</Link>
        <Link href="/privasi#hubungi">{tr("Hubungi kami")}</Link>
        <span className="flex w-full flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <a href="mailto:hi@hrboost.io">{tr("hi@hrboost.io")}</a>
          <a href="https://wa.me/60194442424">{tr("WhatsApp 019-444 2424")}</a>
          <span>{tr("D-G-6 Putra Walk, Taman Pinggiran Putra, 43300 Seri Kembangan, Selangor")}</span>
        </span>
      </footer>
    </div>
  );
}
