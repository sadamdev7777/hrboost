"use client";

import { useParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getDataSurat, type DataSurat } from "@/lib/urusan";
import { BackHeader, ErrorBox, Loading } from "@/components/ui";
import { labelJenis } from "@/lib/hr";

const BULAN = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const tarikhSurat = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const rm = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ic = (s: string | null) => (s && /^\d{12}$/.test(s) ? `${s.slice(0, 6)}-${s.slice(6, 8)}-${s.slice(8)}` : (s ?? "-"));

/** Surat pengesahan (A4) — "Simpan sebagai PDF" melalui dialog cetak pelayar. */
export default function SuratPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const d = useData(() => getDataSurat(id), [id]);
  const balik = me.roles.includes("hr") || me.roles.includes("admin") ? "/pengurusan/surat" : "/mohon/surat";
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 18mm } .no-print { display: none !important } .kertas { box-shadow: none !important; padding: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print mx-auto max-w-[794px]">
        <BackHeader title="Surat" href={balik} />
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
              Simpan sebagai PDF / Cetak
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Kertas({ s }: { s: DataSurat }) {
  const tetap = s.employment_type === "permanent";
  return (
    <article className="kertas mx-auto flex max-w-[794px] flex-col gap-5 bg-white px-8 py-10 font-serif text-[14px] leading-relaxed text-black shadow-sm sm:px-14">
      <header className="flex flex-col gap-0.5 border-b-2 border-black pb-3 text-center">
        <b className="text-lg tracking-wide uppercase">{s.company.name}</b>
        {s.company.reg_no && <span className="text-xs">({s.company.reg_no})</span>}
        {s.company.address && <span className="text-xs">{s.company.address}</span>}
      </header>
      <div className="flex justify-between gap-4 text-[13px]">
        <span>Rujukan: {s.ref_no}</span>
        <span>Tarikh: {tarikhSurat(s.issued_at.slice(0, 10))}</span>
      </div>
      {s.addressed_to ? (
        <p className="m-0">
          Kepada:
          <br />
          {s.addressed_to}
        </p>
      ) : (
        <p className="m-0">Kepada sesiapa yang berkenaan,</p>
      )}
      <p className="m-0 font-bold uppercase underline">
        {s.kind === "salary" ? "Pengesahan jawatan dan gaji" : "Pengesahan majikan"}: {s.full_name}
      </p>
      <p className="m-0">
        Dengan hormatnya perkara di atas adalah dirujuk. Kami dengan ini mengesahkan bahawa <b>{s.full_name}</b> (No. kad pengenalan: {ic(s.ic_no)}) adalah
        pekerja {tetap ? "tetap" : labelJenis(s.employment_type).toLowerCase()} {s.company.name} sejak {tarikhSurat(s.join_date)}
        {s.position ? (
          <>
            , dan kini memegang jawatan sebagai <b>{s.position}</b>
            {s.department ? ` di Jabatan ${s.department}` : ""}
          </>
        ) : s.department ? (
          `, di Jabatan ${s.department}`
        ) : (
          ""
        )}
        .
      </p>
      {s.kind === "salary" && s.basic != null && (
        <table className="w-full max-w-[420px] border-collapse text-[14px]">
          <tbody>
            <tr>
              <td className="py-1">Gaji pokok bulanan</td>
              <td className="py-1 text-right">{rm(Number(s.basic))}</td>
            </tr>
            <tr>
              <td className="py-1">Elaun tetap bulanan</td>
              <td className="py-1 text-right">{rm(Number(s.allowances ?? 0))}</td>
            </tr>
            <tr className="border-t border-black font-bold">
              <td className="py-1">Jumlah pendapatan tetap bulanan</td>
              <td className="py-1 text-right">{rm(Number(s.basic) + Number(s.allowances ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="m-0">Surat ini dikeluarkan atas permintaan pekerja tersebut bagi tujuan {s.purpose.toLowerCase()} dan tidak boleh digunakan untuk tujuan lain.</p>
      <p className="m-0">Sekian, terima kasih.</p>
      <div className="flex flex-col gap-0.5 pt-10">
        <span className="w-56 border-t border-black pt-1 font-bold">{s.signatory?.name ?? "Pengurus Sumber Manusia"}</span>
        <span>{s.signatory?.position ?? "Pengurus Sumber Manusia"}</span>
        <span>{s.company.name}</span>
      </div>
      <footer className="mt-6 border-t border-[#ccc] pt-2 text-center text-[11px] text-[#555]">
        Surat ini dijana melalui HRBoost.io. Pengesahan boleh dibuat dengan menghubungi HR {s.company.name} dengan menyebut rujukan {s.ref_no}.
      </footer>
    </article>
  );
}
