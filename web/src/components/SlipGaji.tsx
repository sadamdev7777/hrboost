"use client";

import { LogoSyarikat } from "./Logo";
import { tr } from "@/lib/i18n";
import type { Slip } from "@/lib/gaji";
import { BULAN_PENUH, BULAN_RINGKAS } from "@/lib/gaji";
import { tarikh } from "@/lib/format";

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sorokIC = (ic: string | null) => (ic ? `••••••-••-${ic.replace(/\D/g, "").slice(-4)}` : "-");

const LABEL_POTONGAN: Record<string, string> = {
  EPF: tr("KWSP (pekerja)"),
  SOCSO: tr("PERKESO (pekerja)"),
  EIS: tr("SIP / EIS (pekerja)"),
  SKBBK: tr("Lindung 24 Jam (SKBBK)"),
  PCB: tr("PCB / MTD"),
  CP38: tr("CP38 (arahan LHDN)"),
  ZAKAT: tr("Zakat"),
  UNPAID: tr("Cuti tanpa gaji"),
};
const LABEL_MAJIKAN: Record<string, string> = { EPF_ER: tr("KWSP"), SOCSO_ER: tr("PERKESO"), EIS_ER: tr("SIP / EIS"), HRDF: "HRDF" };

/** Slip gaji A4 (rujukan reka bentuk: design/SlipGaji.dc.html). Dicetak sebagai PDF melalui pelayar. */
export function SlipGaji({ s }: { s: Slip }) {
  const earn = s.lines.filter((l) => l.kind === "earning");
  const ded = s.lines.filter((l) => l.kind === "deduction");
  const er = s.lines.filter((l) => l.kind === "employer");
  const bik = s.lines.filter((l) => l.kind === "benefit");
  const jumlahEarn = earn.reduce((a, l) => a + l.amount, 0);
  const jumlahDed = ded.reduce((a, l) => a + l.amount, 0);
  const ada = (code: string) => s.lines.some((l) => l.code === code);
  const rujukan = `${s.company.code}-${s.year}${String(s.month).padStart(2, "0")}-${s.employee.employeeNo.replace(/\D/g, "").slice(-4)}`;

  return (
    <article className="slip mx-auto flex w-full max-w-[794px] flex-col gap-4 bg-white p-6 text-[12px] text-ink sm:p-10" aria-label={tr("Slip gaji")}>
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-3">
        <div className="flex flex-col gap-0.5">
          {s.company.logo_path && <LogoSyarikat path={s.company.logo_path} nama={s.company.name} className="mb-1.5 h-12 max-w-[200px] object-left" />}
          <b className="text-[15px] font-extrabold uppercase">{s.company.name}</b>
          {s.company.reg_no && <span className="text-muted">{tr("No. Syarikat {0}", s.company.reg_no)}</span>}
          <span className="text-muted">
            {tr("No. Majikan KWSP {0} · PERKESO {1} · LHDN {2}", s.company.epf ?? "-", s.company.socso ?? "-", s.company.lhdn ?? "-")}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <b className="text-[15px] font-extrabold tracking-[0.06em] text-primary">{tr("SLIP GAJI")}</b>
          <span className="font-bold">
            {BULAN_PENUH[s.month - 1]} {s.year}
          </span>
          {s.label && <span className="font-bold text-primary">{s.label}</span>}
          {s.payDate && <span className="text-muted">{tr("Dibayar {0} {1}", tarikh(s.payDate), s.payDate.slice(0, 4))}</span>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1">
        <Row k={tr("Nama")} v={s.employee.fullName} />
        <Row k={tr("No. pekerja")} v={s.employee.employeeNo} />
        <Row k={tr("No. kad pengenalan")} v={sorokIC(s.employee.ic)} />
        <Row k={tr("Jabatan")} v={s.employee.department ?? "-"} />
        <Row k={tr("Jawatan")} v={s.employee.position ?? "-"} />
        <Row k={tr("No. KWSP")} v={s.employee.epfNo ?? "-"} />
        <Row k={tr("No. cukai")} v={s.employee.taxNo ?? "-"} />
        <Row k={tr("No. PERKESO")} v={s.employee.socsoNo ?? "-"} />
        <Row k={tr("Bank")} v={s.employee.bank ? `${s.employee.bank} ••••${(s.employee.account ?? "").slice(-4)}` : "-"} />
        <Row k={tr("Cuti tanpa gaji")} v={tr("{0} hari", s.unpaidDays)} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Jadual tajuk={tr("PENDAPATAN")} baris={earn.map((l) => [l.description + (l.code === "CLAIM" ? " *" : ""), rm(l.amount)])} jumlah={[tr("Jumlah pendapatan"), rm(jumlahEarn)]} />
        <Jadual tajuk={tr("POTONGAN")} baris={ded.map((l) => [LABEL_POTONGAN[l.code] ?? l.description, rm(l.amount)])} jumlah={[tr("Jumlah potongan"), rm(jumlahDed)]} />
      </section>

      <section className="flex items-center justify-between rounded-[12px] bg-[#E3F1EE] px-5 py-3.5 text-primary">
        <b className="text-[13px] font-extrabold tracking-[0.06em]">{tr("GAJI BERSIH")}</b>
        <b className="text-[22px] font-extrabold">{tr("RM {0}", rm(s.net))}</b>
      </section>

      {bik.length > 0 && (
        <section>
          <Jadual tajuk={tr("MANFAAT BERUPA BARANGAN (BIK) — BERCUKAI, TIDAK DIBAYAR TUNAI")} baris={bik.map((l) => [l.description, rm(l.amount)])} />
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Jadual tajuk={tr("CARUMAN MAJIKAN")} baris={er.map((l) => [LABEL_MAJIKAN[l.code] ?? l.description, rm(l.amount)])} />
        {s.options.ytd && (
          <Jadual
            tajuk={tr("TERKUMPUL {0} ({1}–{2})", s.year, BULAN_RINGKAS[0].toUpperCase(), BULAN_RINGKAS[s.month - 1].toUpperCase())}
            baris={[
              [tr("Pendapatan kasar"), rm(s.ytd.gross)],
              [tr("KWSP pekerja"), rm(s.ytd.epf)],
              ["PCB", rm(s.ytd.pcb)],
            ]}
          />
        )}
        {s.options.leave_summary && s.cuti.length > 0 && (
          <Jadual tajuk={tr("BAKI CUTI (HARI)")} baris={s.cuti.map((c) => [c.name, String(c.available)])} kanan={tr("Hari")} />
        )}
      </section>

      <footer className="flex flex-col gap-1 border-t border-line-soft pt-3 text-[11px] text-muted">
        {ada("CLAIM") && <span>{tr("* Bayaran balik tuntutan tidak dikenakan KWSP, PERKESO atau cukai.")}</span>}
        {s.lines.some((l) => l.code === "ARREARS") && <span>{tr("Tunggakan gaji: perbezaan gaji bagi bulan terdahulu akibat kenaikan gaji berkuat kuasa ke belakang.")}</span>}
        <span>{s.options.disclaimer || tr("Slip ini dijana oleh komputer. Tandatangan tidak diperlukan.")}</span>
        <div className="flex justify-between">
          <span className="font-bold">{tr("Sulit — untuk penerima sahaja.")}</span>
          <span>{tr("Rujukan slip {0}", rujukan)}</span>
        </div>
      </footer>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[#EEF2F1] py-1">
      <span className="text-muted">{k}</span>
      <b className="text-right font-bold">{v}</b>
    </div>
  );
}

function Jadual({ tajuk, baris, jumlah, kanan = "RM" }: { tajuk: string; baris: [string, string][]; jumlah?: [string, string]; kanan?: string }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-ink text-left text-[11px] tracking-[0.04em] text-[#4A5A57]">
          <th className="py-1 font-bold">{tajuk}</th>
          <th className="py-1 text-right font-bold">{kanan}</th>
        </tr>
      </thead>
      <tbody>
        {baris.map(([k, v], i) => (
          <tr key={i} className="border-b border-[#EEF2F1]">
            <td className="py-1">{k}</td>
            <td className="py-1 text-right tabular-nums">{v}</td>
          </tr>
        ))}
        {jumlah && (
          <tr className="font-extrabold">
            <td className="py-1.5">{jumlah[0]}</td>
            <td className="py-1.5 text-right tabular-nums">{jumlah[1]}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
