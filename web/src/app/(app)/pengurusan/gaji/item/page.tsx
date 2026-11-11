"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { LABEL_JENIS_ITEM, MEDAN_EA, getKatalog, simpanItem, type ItemGaji, type MedanEa } from "@/lib/gajiLengkap";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PengepalaAkar, TabNav } from "@/components/TabNav";
import { TabGaji } from "@/components/TabGaji";
import { ButangUtama, Cip, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, Tag, inputKecil } from "@/components/Senarai";
import { beritahu } from "@/components/Dialog";

/** Item gaji: katalog pendapatan, potongan & manfaat (BIK) dengan bendera berkanun dan medan Borang EA. */
export default function ItemGajiPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

const KUMPULAN: ItemGaji["kind"][] = ["earning", "deduction", "benefit"];
const DIKIRA_SISTEM = ["CLAIM", "UNPAID", "OT_LULUS"];

function Kandungan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(() => getKatalog(cid), [cid]);
  const [ubah, setUbah] = useState<ItemGaji | "baharu" | null>(null);
  const [tapis, setTapis] = useState<"aktif" | "semua">("aktif");
  const senarai = (d.data ?? []).filter((i) => !DIKIRA_SISTEM.includes(i.code) && (tapis === "semua" || i.active));

  return (
    <Screen lebar="lebar">
      <PengepalaAkar title={tr("Penggajian")} />
      <TabGaji />
      <main className="flex grow flex-col gap-3 px-4 pt-4 pb-6 lg:px-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grow text-sm leading-normal text-subtle">
            {tr("Setiap item menentukan sama ada ia dikenakan cukai, KWSP, PERKESO, SIP dan HRDF, serta medan Borang EA. Item sistem tidak boleh dipadam.")}
          </span>
          <Cip on={tapis === "aktif"} onClick={() => setTapis("aktif")}>
            {tr("Aktif")}
          </Cip>
          <Cip on={tapis === "semua"} onClick={() => setTapis("semua")}>
            {tr("Semua")}
          </Cip>
          <button type="button" onClick={() => setUbah("baharu")} className="flex h-10 items-center rounded-full bg-primary px-4 text-[13px] font-extrabold text-white">
            {tr("+ Tambah item")}
          </button>
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {KUMPULAN.map((k) => {
          const xs = senarai.filter((i) => i.kind === k);
          if (!xs.length) return null;
          return (
            <section key={k} aria-label={LABEL_JENIS_ITEM[k]} className="flex flex-col gap-2">
              <Seksyen className="pt-1">
                {LABEL_JENIS_ITEM[k].toUpperCase()} ({xs.length})
              </Seksyen>
              <div className="flex flex-col rounded-card bg-surface px-4 lg:px-5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
                {xs.map((i) => (
                  <button
                    key={i.code}
                    type="button"
                    onClick={() => setUbah(i)}
                    className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left text-sm ${i.active ? "" : "opacity-60"}`}
                  >
                    <span className="flex min-w-0 grow basis-56 flex-col gap-0.5">
                      <b className="font-bold">
                        {i.name} {!i.active && <Tag>{tr("Tidak aktif")}</Tag>}
                      </b>
                      <span className="text-xs text-muted">
                        {i.code}
                        {i.ea_field ? ` · EA ${i.ea_field}` : ""}
                        {i.account_ref ? ` · ${tr("Akaun")} ${i.account_ref}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {k !== "deduction" && (
                        <>
                          <Bendera on={i.taxable}>{tr("Cukai")}</Bendera>
                          <Bendera on={i.epf}>KWSP</Bendera>
                          <Bendera on={i.socso}>PERKESO</Bendera>
                          <Bendera on={i.eis}>SIP</Bendera>
                          <Bendera on={i.hrdf}>HRDF</Bendera>
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      {ubah && (
        <BorangItem
          companyId={cid}
          item={ubah === "baharu" ? null : ubah}
          onClose={(ok) => {
            setUbah(null);
            if (ok) d.reload();
          }}
        />
      )}
      <TabNav />
    </Screen>
  );
}

function Bendera({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-[#E3F1EE] text-primary" : "bg-[#F1F4F3] text-[#9AA8A5] line-through"}`}>{children}</span>
  );
}

function BorangItem({ companyId, item, onClose }: { companyId: string; item: ItemGaji | null; onClose: (ok: boolean) => void }) {
  const [f, setF] = useState({
    name: item?.nameAsal ?? "",
    kind: item?.kind ?? ("earning" as ItemGaji["kind"]),
    taxable: item?.taxable ?? true,
    epf: item?.epf ?? true,
    socso: item?.socso ?? true,
    eis: item?.eis ?? true,
    hrdf: item?.hrdf ?? true,
    ea_field: item?.ea_field ?? ("B1c" as MedanEa | null),
    active: item?.active ?? true,
    account_ref: item?.account_ref ?? "",
    in_table: item?.in_table ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const sistem = !!item?.is_system;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      const potongan = f.kind === "deduction";
      await simpanItem(companyId, item?.code ?? null, {
        ...f,
        ...(potongan ? { taxable: false, epf: false, socso: false, eis: false, hrdf: false, ea_field: null } : {}),
        ...(f.kind === "benefit" ? { epf: false, socso: false, eis: false, hrdf: false, in_table: false } : {}),
        category: potongan ? "deduction" : f.kind === "benefit" ? "bik" : (item?.category ?? "allowance"),
      });
      beritahu(tr("Item disimpan."));
      onClose(true);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Lembaran title={item ? tr("Ubah item: {0}", item.name) : tr("Item gaji baharu")} onClose={() => onClose(false)}>
      <MedanBorang label={tr("Nama item")}>
        <input className={inputKecil} value={f.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
      </MedanBorang>
      <div className="flex flex-col gap-1.5" role="group" aria-label={tr("Jenis")}>
        <span className="text-[13px] font-bold text-[#4A5A57]">{tr("Jenis")}</span>
        <div className="flex flex-wrap gap-2">
          {KUMPULAN.map((k) => (
            <Cip key={k} on={f.kind === k} onClick={() => !sistem && set("kind", k)}>
              {LABEL_JENIS_ITEM[k]}
            </Cip>
          ))}
        </div>
        {sistem && <span className="text-xs text-muted">{tr("Jenis item sistem tidak boleh diubah.")}</span>}
      </div>
      {f.kind !== "deduction" && (
        <>
          <div className="flex flex-col rounded-[14px] border border-line-soft px-3 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            <BarisBendera label={tr("Dikenakan cukai (PCB)")} on={f.taxable} onChange={(v) => set("taxable", v)} />
            {f.kind === "earning" && (
              <>
                <BarisBendera label={tr("Dikenakan KWSP")} on={f.epf} onChange={(v) => set("epf", v)} />
                <BarisBendera label={tr("Dikenakan PERKESO")} on={f.socso} onChange={(v) => set("socso", v)} />
                <BarisBendera label={tr("Dikenakan SIP")} on={f.eis} onChange={(v) => set("eis", v)} />
                <BarisBendera label={tr("Dikira untuk levi HRDF")} on={f.hrdf} onChange={(v) => set("hrdf", v)} />
              </>
            )}
          </div>
          <MedanBorang label={tr("Medan Borang EA")}>
            <select className={inputKecil} value={f.ea_field ?? ""} onChange={(e) => set("ea_field", (e.target.value || null) as MedanEa | null)}>
              {(Object.keys(MEDAN_EA) as MedanEa[]).map((m) => (
                <option key={m} value={m}>
                  {MEDAN_EA[m]}
                </option>
              ))}
            </select>
          </MedanBorang>
        </>
      )}
      <MedanBorang label={tr("Akaun (jurnal gaji)")} nota={tr("Pilihan. Kosong = akaun lalai dalam Tetapan Gaji.")}>
        <input className={inputKecil} value={f.account_ref} maxLength={60} onChange={(e) => set("account_ref", e.target.value)} />
      </MedanBorang>
      {f.kind !== "benefit" && (
        <BarisBendera
          label={tr("Papar sebagai lajur dalam Gaji Pekerja")}
          nota={tr("Untuk item tetap bulanan. Item sekali sahaja (cth. bonus) dimasukkan semasa Proses Gaji.")}
          on={f.in_table}
          onChange={(v) => set("in_table", v)}
        />
      )}
      {!sistem && <BarisBendera label={tr("Aktif")} on={f.active} onChange={(v) => set("active", v)} />}
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy} disabled={!f.name.trim()}>
        {tr("Simpan")}
      </ButangUtama>
    </Lembaran>
  );
}

function BarisBendera({ label, nota, on, onChange }: { label: string; nota?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      <span className="flex grow flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {nota && <span className="text-xs leading-snug text-muted">{nota}</span>}
      </span>
      <Suis on={on} onChange={onChange} label={label} />
    </div>
  );
}
