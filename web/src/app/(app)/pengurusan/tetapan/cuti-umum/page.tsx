"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { tarikh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Seksyen, Suis } from "@/components/Senarai";

const NEGERI_RINGKAS: Record<string, string> = { "WP Kuala Lumpur": tr("WP KL") };

// Rujukan reka bentuk: design/CutiUmum.dc.html
export default function CutiUmumPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <CutiUmum />
    </HadPeranan>
  );
}

function CutiUmum() {
  const me = useMe();
  const cid = me.active!.companyId;
  const y0 = Number(todayISO().slice(0, 4));
  const [tahun, setTahun] = useState(todayISO().slice(5, 7) >= "10" ? y0 + 1 : y0);
  const d = useData(async () => {
    const sb = getSupabase();
    const [h, c] = await Promise.all([
      sb.rpc("company_holiday_options", { p_company: cid, p_year: tahun }),
      sb.from("companies").select("state").eq("id", cid).single(),
    ]);
    return { h: must(h) ?? [], state: must(c).state };
  }, [cid, tahun]);
  const [pilih, setPilih] = useState<{ tahun: number; ids: Set<string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const semua = d.data?.h ?? [];
  const wajib = semua.filter((h) => h.is_mandatory || h.is_adhoc);
  const opsyen = semua.filter((h) => !h.is_mandatory && !h.is_adhoc);
  const dipilih = pilih?.tahun === tahun ? pilih.ids : new Set(opsyen.filter((h) => h.chosen).map((h) => h.id));
  const jumlah = wajib.length + opsyen.filter((h) => dipilih.has(h.id)).length;
  const cukup = jumlah >= 11;

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      must(await getSupabase().rpc("set_company_holidays", { p_company: cid, p_year: tahun, p_holiday_ids: [...wajib.map((h) => h.id), ...dipilih] }));
      setOk(true);
      setPilih(null);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
    setBusy(false);
  }

  return (
    <Screen lebar="sederhana">
      <BackHeader
        title={tr("Cuti Umum {0}", tahun)}
        href="/pengurusan/tetapan"
        action={
          d.data && <span className="mr-2 flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold text-primary">{NEGERI_RINGKAS[d.data.state] ?? d.data.state}</span>
        }
      />
      <div className="mx-5 grid grid-cols-2 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
        {[y0, y0 + 1].map((y) => (
          <button key={y} type="button" onClick={() => setTahun(y)} className={`h-10 rounded-[10px] text-sm ${tahun === y ? "bg-surface font-extrabold" : "font-semibold text-[#4A5A57]"}`}>
            {y}
          </button>
        ))}
      </div>
      <main className="flex grow flex-col gap-2.5 px-4 pt-3 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && semua.length === 0 && (
          <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">{tr("Tarikh cuti umum {0} belum dimuatkan mengikut warta. HRBoost akan menambahnya apabila diwartakan.", tahun)}</span>
        )}
        {d.data && semua.length > 0 && (
          <>
            <div className={`flex items-center justify-between gap-3 rounded-card px-4 py-3 ${cukup ? "bg-[#E3F1EE] text-primary" : "bg-danger-soft text-danger"}`}>
              <span className="flex flex-col gap-0.5">
                <b className="text-lg font-extrabold">{tr("{0} hari dipilih", jumlah)}</b>
                <span className="text-xs">{cukup ? tr("Memenuhi minimum Akta Kerja. Boleh disimpan.") : tr("Kurang {0} hari lagi untuk memenuhi minimum.", 11 - jumlah)}</span>
              </span>
              <span className="text-right text-xs font-bold">
                {tr("Minimum")}<br />
                {tr("11 hari")}</span>
            </div>
            <Seksyen>{tr("WAJIB · TIDAK BOLEH DIBUANG")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {wajib.map((h) => (
                <div key={h.id} className="flex min-h-12 items-center justify-between gap-2 py-2 text-sm">
                  <b className="font-bold">{h.name}</b>
                  <span className="text-muted">{tarikh(h.holiday_date)}</span>
                </div>
              ))}
            </div>
            <Seksyen className="pt-1">{tr("PILIHAN SYARIKAT")}</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {opsyen.map((h) => {
                const on = dipilih.has(h.id);
                return (
                  <div key={h.id} className="flex min-h-12 items-center gap-2 py-1 text-sm">
                    <span className="flex grow flex-col">
                      <b className="font-bold">{h.name}</b>
                      <span className="text-xs text-muted">{tarikh(h.holiday_date)}</span>
                    </span>
                    <Suis
                      on={on}
                      label={`${on ? tr("Buang") : tr("Pilih")} ${h.name}`}
                      onChange={(v) => {
                        const s = new Set(dipilih);
                        if (v) s.add(h.id);
                        else s.delete(h.id);
                        setOk(false);
                        setPilih({ tahun, ids: s });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-muted">{tr("Cuti umum tambahan yang diumumkan oleh kerajaan akan ditambah secara automatik dan boleh digantikan dengan hari lain.")}</span>
            {ralat && <ErrorBox message={ralat} />}
            {ok && <span className="text-sm font-semibold text-success">{tr("Disimpan. Pekerja akan dimaklumkan.")}</span>}
          </>
        )}
      </main>
      {d.data && semua.length > 0 && (
        <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
          <ButangUtama onClick={simpan} busy={busy} disabled={!cukup}>
            {tr("Simpan & maklumkan pekerja")}</ButangUtama>
        </div>
      )}
    </Screen>
  );
}
