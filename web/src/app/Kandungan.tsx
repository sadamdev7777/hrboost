"use client";

import { bahasa, tr } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { PilihBahasa } from "@/components/PilihBahasa";


// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const MODUL = () => [
  [tr("Cuti & kalendar pasukan"), tr("Mohon dari telefon, hari bekerja dan baki dikira automatik, cuti umum ikut negeri, siapa bercuti hari ini.")],
  [tr("Tuntutan perbelanjaan"), tr("Ambil gambar resit, AI mengisi borang. Had ikut jenis tuntutan, dibayar bersama gaji.")],
  [tr("Kehadiran"), tr("Sambung mesin kehadiran sedia ada. Lewat, tiada rekod dan pembetulan masa di satu skrin.")],
  [tr("Gaji & caruman berkanun"), tr("KWSP, PERKESO, SIP, PCB dan HRDF dikira automatik. Slip gaji ke WhatsApp, fail bank dan fail caruman.")],
  [tr("Borang EA & Borang E"), tr("Borang EA setiap pekerja, C.P.8D dan ringkasan Borang E dijana daripada rekod gaji setahun.")],
  [tr("Kelulusan melalui WhatsApp"), tr("Ketua → HR → CEO atau sebarang susunan. Balas LULUS atau TOLAK terus di WhatsApp.")],
  [tr("Orientasi pekerja baharu"), tr("Jemputan WhatsApp, 8 langkah orientasi di telefon, senarai semak dan penilaian percubaan.")],
  [tr("Pekerja & carta organisasi"), tr("Profil, dokumen dengan tarikh tamat, sejarah perubahan, jabatan dan carta organisasi.")],
  [tr("Peti HR & Pembantu AI"), tr("Pekerja bertanya polisi atau memohon surat pengesahan. Pengumuman sampai ke WhatsApp semua.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const BANDING = () => [
  [tr("Permohonan cuti"), tr("Mesej WhatsApp & borang kertas, mudah terlepas"), tr("Satu aliran kelulusan, peringatan automatik")],
  [tr("Baki cuti"), tr("Dikira manual dalam Excel"), tr("Dikira automatik, pekerja semak sendiri")],
  [tr("Tuntutan"), tr("Resit hilang, kira semula"), tr("Gambar resit, AI isi borang, terus ke gaji")],
  [tr("Gaji & caruman"), tr("Kalkulator berasingan, risiko silap"), tr("KWSP, PERKESO, SIP, PCB dikira serentak")],
  [tr("Borang EA"), tr("Disediakan satu per satu pada Februari"), tr("Semua pekerja sekali gus, dihantar ke WhatsApp")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const LANGKAH = () => [
  [tr("Daftar syarikat"), tr("Isi nama syarikat dan e-mel anda, kemudian sahkan melalui pautan dalam e-mel. Tetapan cuti, kelulusan dan tuntutan disediakan secara automatik mengikut Akta Kerja.")],
  [tr("Import pekerja"), tr("Muat naik senarai Excel sedia ada. Sistem akan memadankan jabatan dan ketua untuk anda semak.")],
  [tr("Pekerja menerima jemputan"), tr("Setiap pekerja menerima pautan di WhatsApp, mengesahkan 4 digit kad pengenalan, mencipta log masuk e-mel dan terus boleh memohon cuti.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const SOALAN = () => [
  [tr("Adakah HRBoost benar-benar percuma?"), tr("Ya. Daftar syarikat, jemput pekerja dan gunakan cuti, tuntutan, kelulusan, kehadiran dan gaji tanpa bayaran dan tanpa kad kredit.")],
  [tr("Adakah sesuai untuk syarikat kecil?"), tr("Ya. HRBoost dibina untuk PKS dengan 5 hingga 200 pekerja: tiada pemasangan, tiada latihan panjang, dan pekerja menggunakan telefon sendiri.")],
  [tr("Adakah data pekerja selamat?"), tr("Setiap syarikat diasingkan sepenuhnya. Hanya HR syarikat anda boleh melihat kad pengenalan, akaun bank, gaji dan sijil cuti sakit, dan setiap akses direkodkan. Pentadbir platform hanya melihat jumlah keseluruhan, bukan data peribadi.")],
  [tr("Adakah kiraan KWSP, PERKESO dan PCB tepat?"), tr("Kadar berkanun disimpan sebagai data dan dikemas kini oleh HRBoost untuk semua syarikat. Semak slip gaji pertama dengan kalkulator rasmi KWSP, PERKESO dan LHDN sebelum membayar.")],
  [tr("Perlukah pekerja memasang aplikasi?"), tr("Tidak. Pekerja menerima pautan di WhatsApp dan boleh terus menggunakan pelayar telefon. Mereka boleh memasangnya pada skrin utama jika mahu.")],
  [tr("Bagaimana jika pekerja tiada WhatsApp?"), tr("HR boleh menyalin pautan jemputan dan menghantarnya melalui saluran lain. Pekerja kemudian log masuk dengan e-mel dan kata laluan.")],
  [tr("Bolehkah saya menggunakan mesin kehadiran sedia ada?"), tr("Ya, mesin CrossChex Cloud boleh disambungkan. Rekod masuk dan keluar diterima secara automatik setiap 5 minit.")],
  [tr("Bolehkah saya mengeksport data saya?"), tr("Ya. Senarai pekerja, baki cuti, kehadiran, tuntutan, laporan dan fail gaji boleh dimuat turun sebagai CSV / Excel pada bila-bila masa.")],
  [tr("Berapa lama untuk mula?"), tr("Kebanyakan syarikat siap dalam satu petang: daftar, import senarai pekerja daripada Excel, semak jabatan dan ketua, kemudian jemput pekerja.")],
  [tr("Bagaimana menghubungi pasukan HRBoost?"), tr("E-mel hi@hrboost.io atau WhatsApp 019-444 2424. Pejabat kami di D-G-6 Putra Walk, Taman Pinggiran Putra, 43300 Seri Kembangan, Selangor.")],
];
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const SKRIN = () => {
  const d = `/skrin/${bahasa()}`;
  return [
    { src: `${d}/pekerja-utama.webp`, alt: tr("Skrin utama pekerja: baki cuti, permohonan dan kehadiran"), tajuk: tr("Pekerja"), sub: tr("Baki cuti, permohonan dan kehadiran di satu skrin."), telefon: true },
    { src: `${d}/pekerja-mohon-cuti.webp`, alt: tr("Skrin mohon cuti: jenis cuti, tarikh dan pelulus"), tajuk: tr("Mohon cuti"), sub: tr("Hari bekerja dan baki dikira semasa memilih tarikh."), telefon: true },
    { src: `${d}/hr-papan-pemuka.webp`, alt: tr("Papan Pemuka HR: tindakan, kehadiran hari ini dan status gaji"), tajuk: tr("Papan Pemuka HR"), sub: tr("Semua yang perlu diuruskan hari ini, ikut modul HR."), telefon: false },
    { src: `${d}/hr-gaji-pekerja.webp`, alt: tr("Jadual Gaji Pekerja dengan KWSP, PERKESO, SIP dan gaji bersih"), tajuk: tr("Gaji pekerja"), sub: tr("KWSP, PERKESO, SIP dan PCB dikira semasa anda menaip."), telefon: false },
  ];
};
// Fungsi (bukan pemalar) supaya teks mengikut bahasa permintaan semasa
const PATUH = () => [tr("Akta Kerja 1955"), tr("KWSP"), tr("PERKESO"), tr("SIP"), tr("PCB / MTD"), "HRDF", tr("Borang EA"), tr("PDPA")];

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
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-sm font-semibold text-[#33433F]">
            {[tr("Percuma, tiada kad kredit"), tr("Sedia dalam satu petang"), tr("Bahasa Melayu & English"), tr("Untuk PKS 5–200 pekerja")].map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-[#E3F1EE] text-[11px] font-extrabold text-primary">✓</span>
                {x}
              </li>
            ))}
          </ul>
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(2,minmax(0,0.6fr))_minmax(0,1.4fr)]">
          {SKRIN().filter((x) => x.telefon).map((x) => (
            <figure key={x.src} className="m-0 flex flex-col gap-2">
              <Image src={x.src} alt={x.alt} width={780} height={1560} sizes="(min-width: 768px) 220px, 100vw" className="w-full rounded-[22px] border-4 border-ink shadow-md" />
              <figcaption className="flex flex-col">
                <b className="text-sm">{x.tajuk}</b>
                <span className="text-[13px] text-[#4A5A57]">{x.sub}</span>
              </figcaption>
            </figure>
          ))}
          <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
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
        <h2 className="m-0 max-w-[680px] text-2xl leading-tight font-extrabold md:text-[34px]">{tr("Semua modul HR yang diperlukan PKS, dalam satu sistem.")}</h2>
        <p className="mt-3 mb-8 max-w-[680px] text-base text-[#4A5A57]">{tr("Tanpa kertas, tanpa Excel berasingan, dan tanpa perlu mengejar sesiapa. Pekerja menggunakan telefon; HR menggunakan komputer.")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODUL().map(([t, s2]) => (
            <div key={t} className="flex flex-col gap-2 rounded-card bg-surface p-5">
              <b className="text-base font-extrabold">{t}</b>
              <span className="text-sm leading-relaxed text-[#4A5A57]">{s2}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="banding" className="mx-auto max-w-[1120px] px-4 pb-14">
        <h2 className="m-0 mb-6 text-2xl leading-tight font-extrabold md:text-[34px]">{tr("Sebelum dan selepas HRBoost")}</h2>
        <div className="overflow-x-auto rounded-card bg-surface">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft text-xs font-bold tracking-[0.04em] text-muted">
                <th className="px-5 py-3">{tr("URUSAN")}</th>
                <th className="px-5 py-3">{tr("CARA LAMA (WHATSAPP & EXCEL)")}</th>
                <th className="px-5 py-3 text-primary">HRBOOST</th>
              </tr>
            </thead>
            <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-[#EEF2F1]">
              {BANDING().map(([u, lama, baru]) => (
                <tr key={u}>
                  <td className="px-5 py-3 font-bold">{u}</td>
                  <td className="px-5 py-3 text-[#4A5A57]">{lama}</td>
                  <td className="px-5 py-3 font-semibold text-primary">{baru}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <li>{tr("Muat turun Borang EA sendiri untuk e-Filing.")}</li>
          </ul>
          <Link href="/masuk" className="flex min-h-11 items-center self-start text-sm font-bold">
            {tr("Sudah dijemput? Log masuk ›")}</Link>
        </div>
        <div className="flex flex-col gap-3 rounded-card bg-surface p-6">
          <h2 className="m-0 text-xl font-extrabold">{tr("Untuk HR & majikan")}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-[#4A5A57]">
            <li>{tr("Semua kelulusan di satu tempat — atau terus dari WhatsApp dengan membalas LULUS.")}</li>
            <li>{tr("Gaji, KWSP, PERKESO, SIP dan PCB dikira secara automatik, termasuk fail untuk bank.")}</li>
            <li>{tr("Papan Pemuka harian: siapa tiada, siapa lewat, apa yang perlu diluluskan.")}</li>
            <li>{tr("Borang EA, C.P.8D dan ringkasan Borang E dijana daripada rekod gaji.")}</li>
          </ul>
          <Link href="/daftar" className="flex min-h-11 items-center self-start text-sm font-bold">
            {tr("Daftar syarikat ›")}</Link>
        </div>
      </section>

      <section id="soalan" className="mx-auto max-w-[1120px] px-4 pt-14">
        <h2 className="m-0 mb-6 text-2xl font-extrabold md:text-[34px]">{tr("Soalan lazim")}</h2>
        <div className="flex flex-col rounded-card bg-surface px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {SOALAN().map(([q, a]) => (
            <details key={q} className="group py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-bold [&::-webkit-details-marker]:hidden">
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

      <footer className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-0 px-4 pt-2 pb-10 text-sm text-muted [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
        <span>{tr("© {0} HRBoost.io", "2026")}</span>
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
