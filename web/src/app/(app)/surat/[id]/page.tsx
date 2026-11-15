"use client";

import { LogoSyarikat } from "@/components/Logo";
import { tr } from "@/lib/i18n";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getDataSurat, type DataSurat } from "@/lib/urusan";
import { BackHeader, ErrorBox, Loading } from "@/components/ui";
import { labelJenis } from "@/lib/hr";

const BULAN = [tr("Januari"), tr("Februari"), tr("Mac"), tr("April"), tr("Mei"), tr("Jun"), tr("Julai"), tr("Ogos"), tr("September"), tr("Oktober"), tr("November"), tr("Disember")];
const HARI = [tr("Ahad"), tr("Isnin"), tr("Selasa"), tr("Rabu"), tr("Khamis"), tr("Jumaat"), tr("Sabtu")];
const tarikhSurat = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "-");
const rm = (n: number) => tr("RM {0}", n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ic = (s: string | null) => (s && /^\d{12}$/.test(s) ? `${s.slice(0, 6)}-${s.slice(6, 8)}-${s.slice(8)}` : (s ?? "-"));

/** Surat (A4) — "Simpan sebagai PDF" melalui dialog cetak pelayar. */
export default function SuratPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const d = useData(() => getDataSurat(id), [id]);
  const hr = me.roles.includes("hr") || me.roles.includes("admin");
  const balik = d.data?.kind === "salary_advance" ? "/pengurusan/gaji/pendahuluan" : hr ? "/pengurusan/surat" : "/mohon/surat";
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 18mm } .no-print { display: none !important } .kertas { box-shadow: none !important; padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title={tr("Surat")} href={balik} />
      </div>
      {d.error && (
        <div className="px-4">
          <ErrorBox message={d.error} />
        </div>
      )}
      {!d.data && !d.error && <Loading />}
      {d.data && (
        <>
          <div className="px-2 pb-28 sm:px-5 print:p-0">
            <Kertas s={d.data} />
          </div>
          <div className="no-print fixed inset-x-0 bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
            <button type="button" onClick={() => window.print()} className="mx-auto block h-12 w-full max-w-[440px] rounded-button bg-primary text-base font-extrabold text-white">
              {tr("Simpan sebagai PDF / Cetak")}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ bahagian surat

function Kepala({ s }: { s: DataSurat }) {
  return (
    <header className="flex flex-col gap-0.5 border-b-2 border-black pb-3 text-center">
      {s.logo_path && (
        <span className="mb-2 flex justify-center">
          <LogoSyarikat path={s.logo_path} nama={s.company.name} className="h-16 max-w-[260px]" />
        </span>
      )}
      <b className="text-lg tracking-wide uppercase">{s.company.name}</b>
      {s.company.reg_no && <span className="text-xs">({s.company.reg_no})</span>}
      {s.company.address && <span className="text-xs">{s.company.address}</span>}
    </header>
  );
}

function RujukanTarikh({ s, sulit }: { s: DataSurat; sulit?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span>
        {tr("Rujukan: {0}", s.ref_no)}
        {sulit && <b className="ml-3">{tr("SULIT")}</b>}
      </span>
      <span>{tr("Tarikh: {0}", tarikhSurat(s.issued_at.slice(0, 10)))}</span>
    </div>
  );
}

/** Penerima: pekerja (nama penuh ikut kad pengenalan & alamat) */
function KepadaPekerja({ s }: { s: DataSurat }) {
  return (
    <p className="m-0">
      <b>{s.full_name}</b>
      <br />
      {tr("No. kad pengenalan: {0}", ic(s.ic_no))}
      {s.address && (
        <>
          <br />
          <span className="whitespace-pre-line">{s.address}</span>
        </>
      )}
    </p>
  );
}

function Tajuk({ children }: { children: ReactNode }) {
  return <p className="m-0 font-bold uppercase underline">{children}</p>;
}

function Jadual({ baris }: { baris: [string, ReactNode][] }) {
  return (
    <table className="w-full border-collapse text-[14px]">
      <tbody>
        {baris.map(([k, v]) => (
          <tr key={k} className="align-top">
            <td className="w-[42%] py-1 pr-3">{k}</td>
            <td className="py-1">: {v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tandatangan({ s }: { s: DataSurat }) {
  return (
    <div className="flex flex-col gap-0.5 pt-10">
      <span className="w-56 border-t border-black pt-1 font-bold">{s.signatory?.name ?? tr("Pengurus Sumber Manusia")}</span>
      <span>{s.signatory?.position ?? tr("Pengurus Sumber Manusia")}</span>
      <span>{s.company.name}</span>
    </div>
  );
}

/** Ruang akuan pekerja (tawaran / amaran / tunjuk sebab) */
function Akuan({ s, teks }: { s: DataSurat; teks: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-black pt-4">
      <b className="text-[13px] uppercase">{tr("Akuan penerimaan")}</b>
      <p className="m-0">{teks}</p>
      <div className="grid grid-cols-2 gap-6 pt-8 text-[13px]">
        <span className="border-t border-black pt-1">
          {s.full_name}
          <br />
          {tr("No. kad pengenalan: {0}", ic(s.ic_no))}
        </span>
        <span className="border-t border-black pt-1">{tr("Tarikh")}</span>
      </div>
    </div>
  );
}

function Nota({ teks }: { teks?: string }) {
  return teks ? <p className="m-0 whitespace-pre-line">{teks}</p> : null;
}

/** Waktu bekerja daripada jadual syarikat, cth. "Isnin – Jumaat 08:00 – 16:30; Sabtu 08:00 – 12:30" */
function waktuKerja(s: DataSurat): string {
  if (s.details?.work_hours) return s.details.work_hours;
  const j = s.work_schedule;
  if (j && Object.keys(j).length) {
    const kumpulan: { hari: number[]; masa: string }[] = [];
    for (const h of [1, 2, 3, 4, 5, 6, 0]) {
      const x = j[String(h)];
      if (!x) continue;
      const masa = `${x.start} – ${x.end}`;
      const akhir = kumpulan[kumpulan.length - 1];
      if (akhir && akhir.masa === masa && (akhir.hari[akhir.hari.length - 1] + 1) % 7 === h) akhir.hari.push(h);
      else kumpulan.push({ hari: [h], masa });
    }
    return kumpulan.map((k) => `${k.hari.length > 1 ? `${HARI[k.hari[0]]} – ${HARI[k.hari[k.hari.length - 1]]}` : HARI[k.hari[0]]} ${k.masa}`).join("; ");
  }
  if (s.work_start && s.work_end) {
    const rehat = new Set(s.weekend_days ?? [0, 6]);
    const hari = [1, 2, 3, 4, 5, 6, 0].filter((h) => !rehat.has(h));
    const julat = hari.length ? `${HARI[hari[0]]} – ${HARI[hari[hari.length - 1]]}` : "";
    return `${julat} ${s.work_start} – ${s.work_end}`.trim();
  }
  return "-";
}

const PERINGKAT_AMARAN: Record<string, string> = { "1": tr("pertama"), "2": tr("kedua"), "3": tr("terakhir") };

// ------------------------------------------------------------------ badan surat ikut jenis

function Badan({ s }: { s: DataSurat }) {
  const d = s.details ?? {};
  const jawatan = s.position ?? tr("pekerja");
  const jabatan = s.department ? tr(" di Jabatan {0}", s.department) : "";
  switch (s.kind) {
    case "offer":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{s.position ? tr("Tawaran pekerjaan sebagai {0}", s.position) : tr("Tawaran pekerjaan")}</Tajuk>
          <p className="m-0">
            {s.position
              ? tr("Dengan sukacitanya kami menawarkan kepada tuan/puan jawatan {0}{1}, {2}, tertakluk kepada terma dan syarat berikut:", s.position, jabatan, s.company.name)
              : tr("Dengan sukacitanya kami menawarkan pekerjaan kepada tuan/puan{0}, {1}, tertakluk kepada terma dan syarat berikut:", jabatan, s.company.name)}
          </p>
          <Jadual
            baris={[
              ...(s.position ? ([[tr("Jawatan"), s.position]] as [string, ReactNode][]) : []),
              ...(s.department ? ([[tr("Jabatan"), s.department]] as [string, ReactNode][]) : []),
              [tr("Jenis pekerjaan"), labelJenis(s.employment_type)],
              [tr("Tarikh mula bertugas"), tarikhSurat(s.join_date)],
              ...(s.probation_end_date ? ([[tr("Tempoh percubaan"), tr("Sehingga {0}", tarikhSurat(s.probation_end_date))]] as [string, ReactNode][]) : []),
              [tr("Gaji pokok bulanan"), rm(Number(s.basic ?? 0))],
              ...(Number(s.allowances ?? 0) > 0 ? ([[tr("Elaun tetap bulanan"), rm(Number(s.allowances))]] as [string, ReactNode][]) : []),
              [tr("Waktu bekerja"), waktuKerja(s)],
              ...(s.leave?.AL != null ? ([[tr("Cuti tahunan"), tr("{0} hari setahun", s.leave.AL)]] as [string, ReactNode][]) : []),
              ...(s.leave?.MC != null ? ([[tr("Cuti sakit"), tr("{0} hari setahun", s.leave.MC)]] as [string, ReactNode][]) : []),
              [tr("Caruman berkanun"), tr("KWSP, PERKESO dan SIP mengikut kadar semasa")],
            ]}
          />
          <Nota teks={d.note} />
          <p className="m-0">
            {tr("Terma perkhidmatan lain adalah tertakluk kepada Akta Kerja 1955 dan buku panduan pekerja syarikat. Sila tandatangani akuan di bawah sebagai tanda penerimaan dan kembalikan kepada kami selewat-lewatnya pada {0}. Tawaran ini terbatal sekiranya tidak diterima sebelum tarikh tersebut.", tarikhSurat(d.accept_by))}
          </p>
          <p className="m-0">{tr("Kami mengalu-alukan tuan/puan menyertai {0}.", s.company.name)}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
          <Akuan s={s} teks={tr("Saya menerima tawaran pekerjaan di atas mengikut terma dan syarat yang dinyatakan.")} />
        </>
      );
    case "confirmation":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Pengesahan dalam jawatan")}</Tajuk>
          <p className="m-0">
            {tr("Sukacita dimaklumkan bahawa pihak pengurusan telah meluluskan pengesahan tuan/puan dalam jawatan {0}{1} berkuat kuasa {2}, setelah menamatkan tempoh percubaan dengan memuaskan.", jawatan, jabatan, tarikhSurat(d.effective_date))}
          </p>
          {s.basic != null && <p className="m-0">{tr("Gaji pokok bulanan tuan/puan ialah {0}. Terma dan syarat perkhidmatan yang lain kekal seperti dalam surat tawaran.", rm(Number(s.basic)))}</p>}
          <Nota teks={d.note} />
          <p className="m-0">{tr("Tahniah, dan terima kasih atas sumbangan tuan/puan kepada syarikat.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
        </>
      );
    case "probation_extension":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Lanjutan tempoh percubaan")}</Tajuk>
          <p className="m-0">
            {tr("Dimaklumkan bahawa tempoh percubaan tuan/puan sebagai {0}{1}, yang sepatutnya tamat pada {2}, dilanjutkan sehingga {3}.", jawatan, jabatan, tarikhSurat(d.old_end_date), tarikhSurat(d.new_end_date))}
          </p>
          <p className="m-0">{tr("Lanjutan ini diberikan bagi membolehkan tuan/puan memperbaiki perkara berikut:")}</p>
          <Nota teks={d.improve} />
          <p className="m-0">{tr("Prestasi tuan/puan akan dinilai semula sebelum tarikh tersebut. Sila berbincang dengan ketua jabatan sekiranya memerlukan sebarang sokongan.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
        </>
      );
    case "resignation_accept":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Penerimaan peletakan jawatan")}</Tajuk>
          <p className="m-0">
            {tr("Kami merujuk kepada notis peletakan jawatan tuan/puan bertarikh {0}. Pihak syarikat menerima peletakan jawatan tuan/puan sebagai {1}{2}, dan hari bekerja terakhir tuan/puan ialah {3}.", tarikhSurat(d.notice_date), jawatan, jabatan, tarikhSurat(s.end_date))}
          </p>
          {(s.assets ?? []).length > 0 ? (
            <>
              <p className="m-0">{tr("Sila pulangkan item syarikat berikut sebelum atau pada hari bekerja terakhir:")}</p>
              <ol className="m-0 pl-6">
                {(s.assets ?? []).map((a, i) => (
                  <li key={i}>
                    {a.name}
                    {a.serial_no ? tr(" (No. siri: {0})", a.serial_no) : ""}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="m-0">{tr("Rekod kami menunjukkan tiada item syarikat yang belum dipulangkan oleh tuan/puan.")}</p>
          )}
          <Nota teks={d.note} />
          <p className="m-0">{tr("Gaji dan bayaran akhir akan dibuat mengikut kitaran gaji biasa selepas semua urusan penyerahan tugas dan item syarikat selesai.")}</p>
          <p className="m-0">{tr("Kami mengucapkan terima kasih atas perkhidmatan tuan/puan bersama {0} dan mendoakan kejayaan tuan/puan pada masa hadapan.", s.company.name)}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
        </>
      );
    case "experience":
      return (
        <>
          <p className="m-0">{tr("Kepada sesiapa yang berkenaan,")}</p>
          <Tajuk>{tr("Surat pengalaman kerja: {0}", s.full_name)}</Tajuk>
          <p className="m-0">
            {tr("Dengan ini disahkan bahawa {0} (No. kad pengenalan: {1}) telah berkhidmat dengan {2} dari {3} hingga {4}. Jawatan terakhir yang disandang ialah {5}{6}.", s.full_name, ic(s.ic_no), s.company.name, tarikhSurat(s.join_date), tarikhSurat(s.end_date), jawatan, jabatan)}
          </p>
          <Nota teks={d.note} />
          <p className="m-0">{tr("Kami mengucapkan terima kasih atas sumbangan beliau dan mendoakan kejayaan beliau pada masa hadapan.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
        </>
      );
    case "salary_increment": {
      const lama = Number(s.old_basic ?? 0);
      const baru = Number(s.new_basic ?? 0);
      const naik = baru - lama;
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Kenaikan gaji")}</Tajuk>
          <p className="m-0">{tr("Sukacita dimaklumkan bahawa pihak pengurusan telah meluluskan kenaikan gaji pokok tuan/puan berkuat kuasa {0}.", tarikhSurat(s.increment_from))}</p>
          <Jadual
            baris={[
              [tr("Gaji pokok lama"), rm(lama)],
              [tr("Gaji pokok baharu"), <b key="b">{rm(baru)}</b>],
              [tr("Kenaikan"), lama > 0 ? `${rm(naik)} (${((naik / lama) * 100).toFixed(1)}%)` : rm(naik)],
              ...(d.reason ? ([[tr("Sebab"), d.reason]] as [string, ReactNode][]) : []),
            ]}
          />
          <p className="m-0">{tr("Terma dan syarat perkhidmatan yang lain kekal tidak berubah. Maklumat gaji ini adalah sulit.")}</p>
          <p className="m-0">{tr("Tahniah, dan terima kasih atas sumbangan tuan/puan.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
        </>
      );
    }
    case "warning":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Surat amaran {0}", PERINGKAT_AMARAN[d.warning_no ?? "1"] ?? "")}</Tajuk>
          <p className="m-0">{tr("Pihak pengurusan merujuk kepada perkara yang berlaku pada {0} seperti berikut:", tarikhSurat(d.incident_date))}</p>
          <Nota teks={d.description} />
          <p className="m-0">{d.rule ? tr("Perbuatan ini bertentangan dengan {0}.", d.rule) : tr("Perbuatan ini bertentangan dengan peraturan dan tatakelakuan syarikat.")}</p>
          <p className="m-0">
            {tr("Dengan ini tuan/puan diberi amaran {0} dan diingatkan supaya tidak mengulangi perbuatan tersebut. Kegagalan mematuhi peraturan syarikat boleh mengakibatkan tindakan tatatertib yang lebih berat, termasuk penamatan perkhidmatan, setelah siasatan wajar dijalankan.", PERINGKAT_AMARAN[d.warning_no ?? "1"] ?? "")}
          </p>
          <p className="m-0">{tr("Salinan surat ini disimpan dalam fail peribadi tuan/puan.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
          <Akuan s={s} teks={tr("Saya mengaku telah menerima dan memahami kandungan surat ini.")} />
        </>
      );
    case "show_cause":
      return (
        <>
          <KepadaPekerja s={s} />
          <p className="m-0">{tr("Tuan/Puan,")}</p>
          <Tajuk>{tr("Surat tunjuk sebab")}</Tajuk>
          <p className="m-0">{tr("Pihak pengurusan mendapati perkara berikut yang berlaku pada {0}:", tarikhSurat(d.incident_date))}</p>
          <Nota teks={d.description} />
          <p className="m-0">
            {tr("Sehubungan itu, tuan/puan dikehendaki memberikan penjelasan bertulis mengapa tindakan tatatertib tidak patut diambil terhadap tuan/puan. Penjelasan hendaklah diserahkan kepada HR selewat-lewatnya pada {0}.", tarikhSurat(d.reply_by))}
          </p>
          <p className="m-0">{tr("Sekiranya tiada penjelasan diterima dalam tempoh tersebut, pihak pengurusan akan membuat keputusan berdasarkan maklumat yang ada.")}</p>
          <p className="m-0">{tr("Sekian, terima kasih.")}</p>
          <Tandatangan s={s} />
          <Akuan s={s} teks={tr("Saya mengaku telah menerima surat ini.")} />
        </>
      );
    case "salary_advance": {
      const a = s.advance;
      return (
        <>
          <Jadual
            baris={[
              [tr("Kepada"), tr("Jabatan Kewangan")],
              [tr("Daripada"), `${s.signatory?.name ?? ""}, ${s.signatory?.position ?? tr("Sumber Manusia")}`],
              [tr("Perkara"), <b key="p">{tr("Pendahuluan gaji: {0} ({1})", s.full_name, s.employee_no)}</b>],
            ]}
          />
          <p className="m-0">{tr("Untuk rekod dan tindakan pihak Kewangan, pendahuluan gaji berikut telah diluluskan:")}</p>
          {a && (
            <Jadual
              baris={[
                [tr("Nama pekerja"), s.full_name],
                [tr("No. pekerja"), s.employee_no],
                ...(s.department ? ([[tr("Jabatan"), s.department]] as [string, ReactNode][]) : []),
                [tr("Jumlah diluluskan"), <b key="j">{rm(Number(a.amount))}</b>],
                [tr("Sebab"), a.reason],
                [tr("Tarikh permohonan"), tarikhSurat(a.requested_at?.slice(0, 10))],
                [tr("Diluluskan oleh"), a.approvers.length ? a.approvers.map((x) => `${x.name}${x.at ? ` (${tarikhSurat(x.at.slice(0, 10))})` : ""}`).join(", ") : "-"],
                [tr("Potongan gaji"), a.deduct_month ? `${BULAN[a.deduct_month - 1]} ${a.deduct_year}` : "-"],
                [tr("Status bayaran"), a.disbursed_at ? tr("Dibayar pada {0}", tarikhSurat(a.disbursed_at.slice(0, 10))) : tr("Belum dibayar")],
                ...(a.bank ? ([[tr("Bank pekerja"), a.bank]] as [string, ReactNode][]) : []),
              ]}
            />
          )}
          <Nota teks={d.note} />
          <p className="m-0">{tr("Jumlah ini ditolak secara automatik daripada gaji pekerja semasa Proses Gaji bagi bulan potongan di atas.")}</p>
          <Tandatangan s={s} />
        </>
      );
    }
    default:
      return <BadanPengesahan s={s} />;
  }
}

/** Surat atas permintaan pekerja: pengesahan majikan / gaji */
function BadanPengesahan({ s }: { s: DataSurat }) {
  const tetap = s.employment_type === "permanent";
  return (
    <>
      {s.addressed_to ? (
        <p className="m-0">
          {tr("Kepada:")}<br />
          {s.addressed_to}
        </p>
      ) : (
        <p className="m-0">{tr("Kepada sesiapa yang berkenaan,")}</p>
      )}
      <p className="m-0 font-bold uppercase underline">
        {s.kind === "salary" ? tr("Pengesahan jawatan dan gaji") : tr("Pengesahan majikan")}: {s.full_name}
      </p>
      <p className="m-0">
        {tr("Dengan hormatnya perkara di atas adalah dirujuk. Kami dengan ini mengesahkan bahawa")}{" "}<b>{s.full_name}</b> {" "}{tr("(No. kad pengenalan: {0}) adalah pekerja {1} {2} sejak {3}", ic(s.ic_no), tetap ? "tetap" : labelJenis(s.employment_type).toLowerCase(), s.company.name, tarikhSurat(s.join_date))}{s.position ? (
          <>
            {tr(", dan kini memegang jawatan sebagai")}{" "}<b>{s.position}</b>
            {s.department ? tr(" di Jabatan {0}", s.department) : ""}
          </>
        ) : s.department ? (
          tr(", di Jabatan {0}", s.department)
        ) : (
          ""
        )}
        .
      </p>
      {s.kind === "salary" && s.basic != null && (
        <table className="w-full max-w-[420px] border-collapse text-[14px]">
          <tbody>
            <tr>
              <td className="py-1">{tr("Gaji pokok bulanan")}</td>
              <td className="py-1 text-right">{rm(Number(s.basic))}</td>
            </tr>
            <tr>
              <td className="py-1">{tr("Elaun tetap bulanan")}</td>
              <td className="py-1 text-right">{rm(Number(s.allowances ?? 0))}</td>
            </tr>
            <tr className="border-t border-black font-bold">
              <td className="py-1">{tr("Jumlah pendapatan tetap bulanan")}</td>
              <td className="py-1 text-right">{rm(Number(s.basic) + Number(s.allowances ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="m-0">{tr("Surat ini dikeluarkan atas permintaan pekerja tersebut bagi tujuan {0} dan tidak boleh digunakan untuk tujuan lain.", s.purpose.toLowerCase())}</p>
      <p className="m-0">{tr("Sekian, terima kasih.")}</p>
      <Tandatangan s={s} />
    </>
  );
}

function Kertas({ s }: { s: DataSurat }) {
  const sulit = ["salary_increment", "warning", "show_cause", "salary_advance"].includes(s.kind);
  return (
    <article className="kertas mx-auto flex max-w-[794px] flex-col gap-5 bg-white px-8 py-10 font-serif text-[14px] leading-relaxed text-black shadow-sm sm:px-14">
      <Kepala s={s} />
      {s.kind === "salary_advance" && <b className="text-center text-base tracking-wide">{tr("MEMO DALAMAN")}</b>}
      <RujukanTarikh s={s} sulit={sulit} />
      <Badan s={s} />
      <footer className="mt-6 border-t border-[#ccc] pt-2 text-center text-[11px] text-[#555]">
        {tr("Surat ini dijana melalui HRBoost.io. Pengesahan boleh dibuat dengan menghubungi HR {0} dengan menyebut rujukan {1}.", s.company.name, s.ref_no)}</footer>
    </article>
  );
}
