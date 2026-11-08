"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { namaJenisTuntutan } from "@/lib/claims";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, inputKecil, inputSempit } from "@/components/Senarai";

type Jenis = { id: string; name: string; limit_per_item: number | null; requires_receipt: boolean; mileage_rate: number | null; active: boolean };
const nombor = (s: string) => {
  const v = s.replace(/[^\d.]/g, "");
  return v === "" ? null : Number(v);
};

// Rujukan reka bentuk: design/T_JenisClaim.dc.html
export default function JenisTuntutanPage() {
  return (
    <HadPeranan roles={["hr", "finance", "admin"]} back="/pengurusan/tetapan">
      <JenisTuntutan />
    </HadPeranan>
  );
}

function JenisTuntutan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const bolehAliran = me.roles.includes("hr") || me.roles.includes("admin");
  const d = useData(async () => {
    const sb = getSupabase();
    const [t, c, wf] = await Promise.all([
      sb.from("claim_types").select("id, name, limit_per_item, requires_receipt, mileage_rate, active").eq("company_id", cid).order("name"),
      sb.from("companies").select("claim_submit_days").eq("id", cid).single(),
      sb
        .from("approval_workflows")
        .select("approval_workflow_steps(step_order, name, approver, approver_role, approver_person_id, condition, skip_if_requester)")
        .eq("company_id", cid)
        .eq("request_type", "claim")
        .maybeSingle(),
    ]);
    const steps = (must(wf)?.approval_workflow_steps ?? []).sort((a, b) => a.step_order - b.step_order);
    return { t: (must(t) ?? []) as Jenis[], hari: must(c).claim_submit_days as number | null, steps };
  }, [cid]);
  const [baru, setBaru] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const ceo = d.data?.steps.find((s) => s.approver === "role" && s.approver_role === "ceo");
  const hadCeo = (ceo?.condition as { value?: number } | undefined)?.value ?? null;

  async function kemas(id: string, patch: Partial<Jenis>) {
    setRalat(null);
    try {
      must(await getSupabase().from("claim_types").update(patch).eq("id", id));
      setOk("Disimpan.");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function tempoh(v: string) {
    const n = nombor(v);
    if (n !== null && !(n >= 1 && n <= 365)) return setRalat("Tempoh mesti antara 1 hingga 365 hari.");
    try {
      must(await getSupabase().from("companies").update({ claim_submit_days: n }).eq("id", cid));
      setOk("Disimpan.");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function had(v: string) {
    if (!d.data || !ceo) return;
    const n = nombor(v);
    const steps = d.data.steps.map((s) => (s === ceo ? { ...s, condition: n ? { field: "amount", op: ">", value: n } : {} } : s));
    try {
      must(await getSupabase().rpc("save_workflow", { p_company: cid, p_type: "claim", p_steps: steps as never }));
      setOk("Disimpan.");
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <Screen>
      <BackHeader title="Jenis tuntutan & had" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-5 pt-1 pb-6">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        <Seksyen>JENIS TUNTUTAN</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {(d.data?.t ?? []).map((t) => (
            <div key={t.id} className={`flex min-h-[60px] items-center gap-2 py-2 ${t.active ? "" : "opacity-60"}`}>
              <span className="flex grow flex-col gap-0.5">
                <b className="text-[15px] font-bold">{namaJenisTuntutan(t.name)}</b>
                <span className="text-xs text-muted">
                  {t.mileage_rate != null ? "Kadar sekilometer · tanpa resit" : `Had setiap item · ${t.requires_receipt ? "perlu resit" : "tanpa resit"}`}
                </span>
              </span>
              <input
                key={`${t.id}-${t.mileage_rate}-${t.limit_per_item}`}
                className={`${inputSempit} w-[104px] text-right`}
                inputMode="decimal"
                aria-label={`${t.mileage_rate != null ? "Kadar" : "Had"} ${namaJenisTuntutan(t.name)}`}
                placeholder="Tiada had"
                defaultValue={t.mileage_rate != null ? `RM ${Number(t.mileage_rate).toFixed(2)}` : t.limit_per_item != null ? `RM ${Number(t.limit_per_item)}` : ""}
                onBlur={(e) => {
                  const n = nombor(e.target.value);
                  if (t.mileage_rate != null) {
                    if (n && n > 0) kemas(t.id, { mileage_rate: n });
                  } else if (n !== t.limit_per_item) kemas(t.id, { limit_per_item: n });
                }}
              />
              <Suis on={t.active} label={`${t.active ? "Matikan" : "Hidupkan"} ${namaJenisTuntutan(t.name)}`} onChange={(v) => kemas(t.id, { active: v })} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setBaru(true)} className="h-12 rounded-[14px] border-2 border-dashed border-[#C9D3D1] text-sm font-bold text-primary">
          + Jenis tuntutan baharu
        </button>

        <Seksyen className="pt-1">PERATURAN</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          <div className="flex min-h-[60px] items-center gap-2 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-[15px] font-bold">Hantar dalam tempoh</b>
              <span className="text-xs text-muted">Selepas tarikh resit · kosong = tiada had</span>
            </span>
            <input
              key={`hari-${d.data?.hari}`}
              className={`${inputSempit} w-[104px] text-right`}
              inputMode="numeric"
              placeholder="Tiada had"
              aria-label="Tempoh hantar tuntutan (hari)"
              defaultValue={d.data?.hari ? `${d.data.hari} hari` : ""}
              onBlur={(e) => {
                if (nombor(e.target.value) !== (d.data?.hari ?? null)) tempoh(e.target.value);
              }}
            />
          </div>
          {ceo && (
            <div className="flex min-h-[60px] items-center gap-2 py-2">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-[15px] font-bold">Perlu kelulusan CEO jika melebihi</b>
                <span className="text-xs text-muted">Peringkat tambahan automatik</span>
              </span>
              <input
                key={`ceo-${hadCeo}`}
                className={`${inputSempit} w-[104px] text-right`}
                inputMode="decimal"
                placeholder="Semua"
                aria-label="Had kelulusan CEO (RM)"
                disabled={!bolehAliran}
                defaultValue={hadCeo ? `RM ${hadCeo.toLocaleString("en-MY")}` : ""}
                onBlur={(e) => {
                  if (nombor(e.target.value) !== hadCeo) had(e.target.value);
                }}
              />
            </div>
          )}
          <div className="flex min-h-[60px] items-center gap-2 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-[15px] font-bold">Bayar melalui</b>
              <span className="text-xs text-muted">Tuntutan yang diluluskan dibayar bersama gaji bulan berikutnya</span>
            </span>
            <b className="text-sm">Gaji</b>
          </div>
        </div>
        {ralat && <ErrorBox message={ralat} />}
        {ok && !ralat && <span className="text-sm font-semibold text-success">{ok}</span>}
      </main>
      {baru && (
        <JenisBaru
          cid={cid}
          onClose={() => setBaru(false)}
          onDone={() => {
            setBaru(false);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function JenisBaru({ cid, onClose, onDone }: { cid: string; onClose: () => void; onDone: () => void }) {
  const [nama, setNama] = useState("");
  const [had, setHad] = useState("");
  const [resit, setResit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    if (!nama.trim()) return setRalat("Sila isi nama jenis tuntutan.");
    setBusy(true);
    try {
      must(await getSupabase().from("claim_types").insert({ company_id: cid, name: nama.trim(), limit_per_item: nombor(had), requires_receipt: resit }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title="Jenis tuntutan baharu" onClose={onClose}>
      <MedanBorang label="Nama">
        <input className={inputKecil} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Telefon bimbit" />
      </MedanBorang>
      <MedanBorang label="Had setiap item (RM)" nota="Kosong = tiada had">
        <input className={inputKecil} inputMode="decimal" value={had} onChange={(e) => setHad(e.target.value)} />
      </MedanBorang>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-primary" checked={resit} onChange={(e) => setResit(e.target.checked)} />
        Perlu resit
      </label>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Tambah
      </ButangUtama>
    </Lembaran>
  );
}
