"use client";

import { tr, trKonteks } from "@/lib/i18n";
import type { ReactNode } from "react";
import { tarikhPenuh } from "@/lib/format";
import type { BarisEA, MajikanEA } from "@/lib/ea";

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Seksyen({ huruf, tajuk, children }: { huruf: string; tajuk: string; children: ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h3 className="m-0 border-b border-[#14211F] pb-1 text-[11px] font-extrabold tracking-[0.03em]">
        {huruf}. {tajuk}
      </h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
function Baris({ no, label, nilai, tebal = false }: { no?: string; label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 border-b border-dotted border-[#C9D2D0] py-1 text-[11px] ${tebal ? "font-extrabold" : ""}`}>
      <span className="w-7 shrink-0 text-[#5B6B68]">{no ?? ""}</span>
      <span className="grow">{label}</span>
      <span className="shrink-0 text-right tabular-nums">{nilai}</span>
    </div>
  );
}

/**
 * Borang EA (C.P.8A) satu pekerja, saiz A4. Susunan bahagian A–F mengikut borang LHDN;
 * medan B diisi mengikut medan EA setiap item gaji (tab Item gaji).
 */
export function BorangEA({ m, r }: { m: MajikanEA; r: BarisEA }) {
  const jumlahB = r.b1a + r.b1b + r.b1c + r.b2 + r.b3 + r.b4 + r.b6;
  return (
    <article className="ea mx-auto w-full max-w-[794px] bg-white px-8 py-7 text-[#14211F] print:break-after-page print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[#5B6B68]">{tr("Lembaga Hasil Dalam Negeri Malaysia")}</span>
          <h2 className="m-0 text-lg font-extrabold">{tr("BORANG EA")}</h2>
          <span className="text-[11px] font-bold">{tr("PENYATA SARAAN DARIPADA PENGGAJIAN BAGI TAHUN BERAKHIR 31 DISEMBER {0}", m.year)}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end text-[11px]">
          <b className="text-sm">C.P.8A</b>
          <span>{tr("No. Siri: {0}", r.employee_no)}</span>
          <span>{tr("No. Majikan E: {0}", m.lhdn_employer_no ?? "—")}</span>
          <span>{tr("No. Cukai Pendapatan Pekerja: {0}", r.tax_no ?? "—")}</span>
        </div>
      </header>
      <p className="m-0 mt-2 text-[10px] text-[#5B6B68]">
        {tr("BORANG EA INI PERLU DISEDIAKAN UNTUK DISERAHKAN KEPADA PEKERJA BAGI TUJUAN CUKAI PENDAPATANNYA")}</p>

      <Seksyen huruf="A" tajuk={tr("BUTIRAN PEKERJA")}>
        <Baris no="1." label={tr("Nama penuh pekerja")} nilai={r.full_name} />
        <Baris no="2." label={tr("Jawatan")} nilai={r.position ?? "—"} />
        <Baris no="3." label={tr("No. kakitangan / No. gaji")} nilai={r.employee_no} />
        <Baris no="4." label={tr("No. kad pengenalan")} nilai={r.ic_no ?? "—"} />
        <Baris no="5." label={tr("No. KWSP")} nilai={r.epf_no ?? "—"} />
        <Baris no="6." label={tr("No. PERKESO")} nilai={r.socso_no ?? "—"} />
        <Baris no="7." label={tr("Jika pekerja mula bekerja dalam tahun ini, nyatakan tarikh mula")} nilai={r.join_date ? tarikhPenuh(r.join_date) : "—"} />
        <Baris no="8." label={tr("Jika pekerja berhenti dalam tahun ini, nyatakan tarikh berhenti")} nilai={r.end_date ? tarikhPenuh(r.end_date) : "—"} />
      </Seksyen>

      <Seksyen huruf="B" tajuk={tr("PENDAPATAN PENGGAJIAN, MANFAAT DAN TEMPAT KEDIAMAN (RM)")}>
        <Baris no="1.(a)" label={tr("Gaji kasar, upah atau gaji cuti (termasuk gaji lebih masa)")} nilai={rm(r.b1a)} />
        <Baris no="(b)" label={tr("Fi (termasuk fi pengarah), komisen atau bonus")} nilai={rm(r.b1b)} />
        <Baris no="(c)" label={tr("Tip kasar, perkuisit, penerimaan sagu hati atau elaun-elaun lain")} nilai={rm(r.b1c)} />
        <Baris no="(d)" label={tr("Cukai pendapatan yang dibayar oleh majikan bagi pihak pekerja")} nilai={rm(0)} />
        <Baris no="(e)" label={tr("Manfaat Skim Opsyen Saham Pekerja (ESOS)")} nilai={rm(0)} />
        <Baris no="(f)" label={tr("Ganjaran bagi tempoh")} nilai={rm(0)} />
        <Baris no="2." label={tr("Butiran bayaran tunggakan dan lain-lain bagi tahun terdahulu dalam tahun semasa")} nilai={rm(r.b2)} />
        <Baris no="3." label={tr("Manfaat berupa barangan")} nilai={rm(r.b3)} />
        <Baris no="4." label={tr("Nilai tempat kediaman yang disediakan oleh majikan")} nilai={rm(r.b4)} />
        <Baris no="5." label={tr("Bayaran balik daripada Kumpulan Wang Simpanan / Pencen yang tidak diluluskan")} nilai={rm(0)} />
        <Baris no="6." label={tr("Pampasan kerana kehilangan pekerjaan")} nilai={rm(r.b6)} />
        <Baris label={trKonteks("JUMLAH", "TOTAL")} nilai={rm(jumlahB)} tebal />
      </Seksyen>

      <Seksyen huruf="C" tajuk={tr("PENCEN DAN LAIN-LAIN (RM)")}>
        <Baris no="1." label={tr("Pencen")} nilai={rm(0)} />
        <Baris no="2." label={tr("Anuiti atau bayaran berkala yang lain")} nilai={rm(0)} />
      </Seksyen>

      <Seksyen huruf="D" tajuk={tr("JUMLAH POTONGAN (RM)")}>
        <Baris no="1." label={tr("Potongan Cukai Bulanan (PCB) yang dibayar kepada LHDN")} nilai={rm(r.pcb)} />
        <Baris no="2." label={tr("Arahan potongan CP38")} nilai={rm(r.cp38)} />
        <Baris no="3." label={tr("Zakat yang dibayar melalui potongan gaji")} nilai={rm(r.zakat)} />
      </Seksyen>

      <Seksyen huruf="E" tajuk={tr("CARUMAN YANG DIBAYAR OLEH PEKERJA (RM)")}>
        <Baris no="1." label={tr("Kumpulan Wang Simpanan Pekerja (KWSP) — caruman wajib bahagian pekerja")} nilai={rm(r.epf)} />
        <Baris no="2." label={tr("PERKESO (Keselamatan Sosial & Sistem Insurans Pekerjaan) — bahagian pekerja")} nilai={rm(r.socso)} />
      </Seksyen>

      <Seksyen huruf="F" tajuk={tr("JUMLAH ELAUN / PERKUISIT / PEMBERIAN / MANFAAT YANG DIKECUALIKAN CUKAI (RM)")}>
        <Baris label={tr("Jumlah")} nilai={rm(0)} />
      </Seksyen>

      <footer className="mt-5 grid grid-cols-2 gap-6 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#5B6B68]">{tr("Nama dan alamat majikan")}</span>
          <b>{m.name}</b>
          {m.reg_no && <span>{tr("No. pendaftaran: {0}", m.reg_no)}</span>}
          {m.address && <span className="whitespace-pre-line">{m.address}</span>}
        </div>
        <div className="flex flex-col gap-6">
          <span className="text-[#5B6B68]">{tr("Tandatangan pegawai yang diberi kuasa")}</span>
          <span className="border-t border-[#14211F] pt-1">{tr("Nama, jawatan & tarikh")}</span>
        </div>
      </footer>
      <p className="m-0 mt-4 text-[9px] text-[#5B6B68]">
        {tr("Dijana oleh HRBoost daripada slip gaji yang diluluskan bagi {0}{1}. Bayaran balik tuntutan tidak dimasukkan kerana bukan pendapatan. Semak dengan rekod syarikat sebelum diedarkan.", m.year, r.has_opening ? tr(" dan data terkumpul daripada sistem terdahulu") : "")}</p>
    </article>
  );
}
