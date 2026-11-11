"use client";

import { tr } from "@/lib/i18n";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { ringgit, tarikhPenuh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";
import { LogoSyarikat } from "@/components/Logo";

type Cp22 = {
  employee: {
    full_name: string;
    ic_no: string | null;
    passport_no: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    gender: string | null;
    marital_status: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_no: string | null;
    epf_no: string | null;
    employee_no: string;
    join_date: string;
    position: string | null;
    children: number | null;
    spouse_working: boolean | null;
    basic: number | null;
  };
  employer: {
    name: string;
    reg_no: string | null;
    lhdn: string | null;
    address: string | null;
    signatory_name: string | null;
    signatory_position: string | null;
    signatory_ic: string | null;
    signatory_phone: string | null;
    signatory_email: string | null;
    logo_path: string | null;
  };
};

/** Borang CP22: pemberitahuan pekerja baharu kepada LHDN (dalam tempoh 30 hari mula bekerja), dicetak / disimpan sebagai PDF. */
export default function Cp22Page() {
  return (
    <HadPeranan roles={["hr", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const { id } = useParams<{ id: string }>();
  const d = useData(async () => must(await getSupabase().rpc("cp22_data", { p_employment: id })) as unknown as Cp22, [id]);
  const x = d.data;
  const kahwin: Record<string, string> = { bujang: tr("Bujang"), berkahwin: tr("Berkahwin"), duda_janda: tr("Duda / Janda") };
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 14mm } .no-print { display: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title={tr("Borang CP22")} href={`/pengurusan/pekerja/${id}`} />
      </div>
      {d.error && <ErrorBox message={d.error} />}
      {d.loading && !x && <Loading />}
      {x && (
        <div className="px-2 pb-28 sm:px-5 print:p-0">
          <article className="mx-auto w-full max-w-[794px] bg-white px-8 py-7 text-[12px] text-ink print:px-0 print:py-0">
            <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
              <div className="flex flex-col gap-0.5">
                {x.employer.logo_path && <LogoSyarikat path={x.employer.logo_path} nama={x.employer.name} className="mb-1 h-10 max-w-[180px] object-left" />}
                <span className="text-[11px] font-bold text-muted">{tr("Lembaga Hasil Dalam Negeri Malaysia")}</span>
                <h1 className="m-0 text-lg font-extrabold">{tr("PEMBERITAHUAN MENGENAI PEKERJA BAHARU")}</h1>
                <span className="text-[11px]">{tr("Kaedah-Kaedah Cukai Pendapatan (Potongan Daripada Saraan) — dihantar dalam tempoh 30 hari dari tarikh mula bekerja")}</span>
              </div>
              <b className="shrink-0 text-base">CP22</b>
            </header>

            <Bahagian tajuk={tr("A. MAKLUMAT PEKERJA")}>
              <Baris k={tr("Nama penuh (seperti kad pengenalan / pasport)")} v={x.employee.full_name} />
              <Baris k={tr("No. kad pengenalan")} v={x.employee.ic_no ?? "—"} />
              <Baris k={tr("No. pasport / negara")} v={x.employee.passport_no ? `${x.employee.passport_no} / ${x.employee.nationality ?? ""}` : "—"} />
              <Baris k={tr("No. cukai pendapatan")} v={x.employee.tax_no ?? tr("Belum ada (majikan memohon melalui e-Daftar)")} />
              <Baris k={tr("Tarikh lahir")} v={x.employee.date_of_birth ? tarikhPenuh(x.employee.date_of_birth) : "—"} />
              <Baris k={tr("Jantina")} v={x.employee.gender === "L" ? tr("Lelaki") : x.employee.gender === "P" ? tr("Perempuan") : "—"} />
              <Baris k={tr("Taraf perkahwinan")} v={x.employee.marital_status ? (kahwin[x.employee.marital_status] ?? x.employee.marital_status) : "—"} />
              <Baris k={tr("Bilangan anak")} v={String(x.employee.children ?? 0)} />
              <Baris k={tr("Pasangan bekerja")} v={x.employee.spouse_working === null ? "—" : x.employee.spouse_working ? tr("Ya") : tr("Tidak")} />
              <Baris k={tr("Alamat kediaman")} v={x.employee.address ?? "—"} />
              <Baris k={tr("Telefon / e-mel")} v={[x.employee.phone, x.employee.email].filter(Boolean).join(" / ") || "—"} />
            </Bahagian>

            <Bahagian tajuk={tr("B. MAKLUMAT PENGGAJIAN")}>
              <Baris k={tr("No. pekerja")} v={x.employee.employee_no} />
              <Baris k={tr("Jawatan")} v={x.employee.position ?? "—"} />
              <Baris k={tr("Tarikh mula bekerja")} v={tarikhPenuh(x.employee.join_date)} />
              <Baris k={tr("Gaji pokok sebulan")} v={x.employee.basic ? ringgit(Number(x.employee.basic)) : "—"} />
              <Baris k={tr("No. KWSP")} v={x.employee.epf_no ?? "—"} />
            </Bahagian>

            <Bahagian tajuk={tr("C. MAKLUMAT MAJIKAN")}>
              <Baris k={tr("Nama majikan")} v={x.employer.name} />
              <Baris k={tr("No. pendaftaran")} v={x.employer.reg_no ?? "—"} />
              <Baris k={tr("No. majikan (E)")} v={x.employer.lhdn ?? "—"} />
              <Baris k={tr("Alamat")} v={x.employer.address ?? "—"} />
            </Bahagian>

            <footer className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted">{tr("Pegawai yang diberi kuasa")}</span>
                <b>{x.employer.signatory_name ?? "……………………………"}</b>
                <span>{x.employer.signatory_position ?? ""}</span>
                <span>{[x.employer.signatory_phone, x.employer.signatory_email].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="flex flex-col justify-end gap-6">
                <span className="border-t border-ink pt-1">{tr("Tandatangan & tarikh")}</span>
              </div>
            </footer>
            <p className="m-0 mt-5 text-[9px] text-muted">
              {tr("Dijana oleh HRBoost sebagai rujukan pengisian CP22. Pemberitahuan rasmi dibuat melalui e-CP22 di portal MyTax atau borang LHDN terkini. Sahkan butiran sebelum dihantar.")}
            </p>
          </article>
        </div>
      )}
      {x && (
        <div className="no-print fixed inset-x-0 bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <button type="button" onClick={() => window.print()} className="mx-auto block h-12 w-full max-w-[440px] rounded-button bg-primary text-base font-extrabold text-white">
            {tr("Simpan sebagai PDF / Cetak")}
          </button>
        </div>
      )}
    </div>
  );
}

function Bahagian({ tajuk, children }: { tajuk: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="m-0 border-b border-ink pb-1 text-[11px] font-extrabold tracking-[0.03em]">{tajuk}</h2>
      {children}
    </section>
  );
}

function Baris({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-dotted border-[#C9D2D0] py-1.5">
      <span className="w-[45%] shrink-0 text-muted">{k}</span>
      <b className="grow font-semibold whitespace-pre-line">{v}</b>
    </div>
  );
}
