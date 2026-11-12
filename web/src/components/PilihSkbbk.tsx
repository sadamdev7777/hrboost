"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { useData } from "@/lib/useData";
import { getSkbbk, setSkbbk, type PekerjaSkbbk } from "@/lib/gajiLengkap";
import { ButangUtama, Lembaran, inputKecil } from "./Senarai";
import { ErrorBox } from "./ui";
import { beritahu } from "./Dialog";

/**
 * Lindung 24 Jam (SKBBK): ringkasan "X daripada Y pekerja menyertai" + senarai untuk memilih pekerja secara pukal.
 * Pekerja asing sentiasa menyertai (wajib) dan dikunci. Tetapan disimpan terus (berasingan daripada borang Tetapan Gaji).
 */
export function PilihSkbbk({ companyId, boleh, lalaiBerubah }: { companyId: string; boleh: boolean; lalaiBerubah: boolean }) {
  const d = useData(() => getSkbbk(companyId), [companyId]);
  const [buka, setBuka] = useState(false);
  const xs = d.data ?? [];
  const sertai = xs.filter((x) => x.joined).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] bg-page px-3.5 py-2.5 text-[13px]">
      {d.error && <ErrorBox message={d.error} />}
      {d.data && (
        <span className="grow">
          <b>{tr("{0} daripada {1} pekerja menyertai", sertai, xs.length)}</b>
          {lalaiBerubah && <span className="block text-xs text-warning">{tr("Simpan tetapan dahulu supaya pilihan lalai baharu diambil kira.")}</span>}
        </span>
      )}
      {d.data && (
        <button type="button" onClick={() => setBuka(true)} className="flex min-h-10 items-center font-bold text-primary">
          {boleh ? tr("Pilih pekerja ›") : tr("Lihat senarai ›")}
        </button>
      )}
      {buka && d.data && (
        <Senarai
          awal={d.data}
          boleh={boleh}
          onClose={() => setBuka(false)}
          onSimpan={async (ids) => {
            const n = await setSkbbk(companyId, ids);
            beritahu(n ? tr("Lindung 24 Jam dikemas kini bagi {0} pekerja.", n) : tr("Tiada perubahan."));
            setBuka(false);
            d.reload();
          }}
        />
      )}
    </div>
  );
}

function Senarai({ awal, boleh, onClose, onSimpan }: { awal: PekerjaSkbbk[]; boleh: boolean; onClose: () => void; onSimpan: (ids: string[]) => Promise<void> }) {
  const [pilih, setPilih] = useState(() => new Set(awal.filter((x) => x.joined && !x.foreign_worker).map((x) => x.employment_id)));
  const [cari, setCari] = useState("");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const tempatan = awal.filter((x) => !x.foreign_worker);
  const papar = awal.filter((x) => !cari.trim() || `${x.name} ${x.employee_no} ${x.department ?? ""}`.toLowerCase().includes(cari.trim().toLowerCase()));
  const jumlah = pilih.size + awal.filter((x) => x.foreign_worker).length;
  const tukar = (id: string) => {
    const s = new Set(pilih);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPilih(s);
  };
  return (
    <Lembaran title={tr("Lindung 24 Jam (SKBBK)")} onClose={onClose} besar>
      <span className="text-[13px] leading-snug text-muted">
        {tr("Tandakan pekerja yang menyertai. Caruman SKBBK hanya dipotong bagi pekerja yang ditanda. Pekerja asing wajib menyertai.")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputKecil} min-w-0 grow`} placeholder={tr("Cari nama, no. pekerja atau jabatan")} value={cari} onChange={(e) => setCari(e.target.value)} />
        {boleh && (
          <>
            <button type="button" onClick={() => setPilih(new Set(tempatan.map((x) => x.employment_id)))} className="h-10 rounded-full border border-line px-3.5 text-[13px] font-bold">
              {tr("Pilih semua")}
            </button>
            <button type="button" onClick={() => setPilih(new Set())} className="h-10 rounded-full border border-line px-3.5 text-[13px] font-bold">
              {tr("Kosongkan")}
            </button>
          </>
        )}
      </div>
      <div className="flex max-h-[50vh] flex-col overflow-y-auto rounded-[12px] border border-line-soft px-3 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {papar.map((x) => {
          const on = x.foreign_worker || pilih.has(x.employment_id);
          const kunci = x.foreign_worker || !boleh;
          return (
            <label key={x.employment_id} className={`flex min-h-12 items-center gap-3 py-2 text-sm ${kunci ? "" : "cursor-pointer"}`}>
              <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={on} disabled={kunci} onChange={() => tukar(x.employment_id)} />
              <span className="flex min-w-0 grow flex-col">
                <b className="truncate">{x.name}</b>
                <span className="truncate text-xs text-muted">{[x.employee_no, x.department].filter(Boolean).join(" · ")}</span>
              </span>
              {x.foreign_worker && <span className="shrink-0 rounded-full bg-[#EEF2F1] px-2.5 py-1 text-xs font-bold text-subtle">{tr("Asing · wajib")}</span>}
            </label>
          );
        })}
        {papar.length === 0 && <span className="py-3 text-sm text-muted">{tr("Tiada pekerja sepadan.")}</span>}
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {boleh && (
        <ButangUtama
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setRalat(null);
            try {
              await onSimpan([...pilih]);
            } catch (e) {
              setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
              setBusy(false);
            }
          }}
        >
          {tr("Simpan · {0} pekerja menyertai", jumlah)}
        </ButangUtama>
      )}
    </Lembaran>
  );
}

export function useBilSkbbk(companyId: string) {
  return useData(async () => (await getSkbbk(companyId)).filter((x) => x.joined).length, [companyId]);
}

