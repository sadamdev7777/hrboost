"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { namaPeringkat } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, inputKecil } from "@/components/Senarai";
import type { Database } from "@/lib/database.types";

type ReqType = Database["public"]["Enums"]["request_type"];
type Peringkat = {
  name: string;
  approver: "dept_head" | "direct_manager" | "role" | "specific_person";
  approver_role: string | null;
  approver_person_id: string | null;
  condition: { field?: string; op?: string; value?: number };
  skip_if_requester: boolean;
};

const JENIS: { id: ReqType; label: string }[] = [
  { id: "leave", label: "Cuti" },
  { id: "claim", label: "Tuntutan" },
  { id: "attendance_correction", label: "Kehadiran" },
  { id: "payroll_run", label: "Gaji" },
];
const PERANAN: Record<string, string> = { hr: "HR", finance: "Kewangan", ceo: "CEO", admin: "Pentadbir" };

function keterangan(s: Peringkat, nama: Record<string, string>, jenis: ReqType): string {
  const siapa =
    s.approver === "dept_head"
      ? "Dikesan secara automatik"
      : s.approver === "direct_manager"
        ? "Pengurus terus pemohon"
        : s.approver === "role"
          ? `Peranan ${PERANAN[s.approver_role ?? ""] ?? s.approver_role} · kelulusan seorang sudah memadai`
          : `Ditetapkan: ${nama[s.approver_person_id ?? ""] ?? "pekerja"}`;
  const langkau = s.skip_if_requester ? " · dilangkau jika pelulus sendiri yang memohon" : "";
  const syarat =
    s.condition?.field === "amount" && s.condition.op === ">"
      ? ` · hanya jika melebihi RM${Number(s.condition.value).toLocaleString("en-MY")}`
      : s.condition?.field === "days" && s.condition.op === ">"
        ? ` · hanya jika melebihi ${s.condition.value} hari`
        : jenis === "leave" && !s.condition?.field
          ? " · semua permohonan"
          : "";
  return siapa + syarat + (s.approver === "dept_head" ? langkau : "");
}

// Rujukan reka bentuk: design/AliranApproval.dc.html
export default function AliranPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Aliran />
    </HadPeranan>
  );
}

function Aliran() {
  const me = useMe();
  const cid = me.active!.companyId;
  const [jenis, setJenis] = useState<ReqType>("leave");
  const d = useData(async () => {
    const sb = getSupabase();
    const [wf, ppl, lt] = await Promise.all([
      sb
        .from("approval_workflows")
        .select("id, cutoff_time, reminder_every_hours, sla, approval_workflow_steps(step_order, name, approver, approver_role, approver_person_id, condition, skip_if_requester)")
        .eq("company_id", cid)
        .eq("request_type", jenis)
        .maybeSingle(),
      sb.rpc("my_colleagues", { p_company: cid }),
      sb.from("leave_types").select("name, sla_exempt").eq("company_id", cid).eq("sla_exempt", true).eq("active", true),
    ]);
    const w = must(wf);
    const steps = ((w?.approval_workflow_steps ?? []) as (Peringkat & { step_order: number })[])
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => ({ ...s, condition: (s.condition ?? {}) as Peringkat["condition"] }));
    return { w, steps, ppl: [{ person_id: me.personId, name: me.name, department_id: null, department: null }, ...(must(ppl) ?? [])], kecuali: (must(lt) ?? []).map((x) => x.name.replace(/^Cuti\s+/, "")) };
  }, [cid, jenis]);
  const [draf, setDraf] = useState<{ jenis: ReqType; steps: Peringkat[] } | null>(null);
  const [ubah, setUbah] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const steps = draf?.jenis === jenis ? draf.steps : (d.data?.steps ?? []);
  const nama = Object.fromEntries((d.data?.ppl ?? []).map((p) => [p.person_id, p.name]));
  const set = (s: Peringkat[]) => {
    setOk(false);
    setDraf({ jenis, steps: s });
  };

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      must(await getSupabase().rpc("save_workflow", { p_company: cid, p_type: jenis, p_steps: steps as never }));
      setDraf(null);
      setOk(true);
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
    setBusy(false);
  }

  return (
    <Screen>
      <BackHeader title="Aliran Kelulusan" href="/pengurusan/tetapan" />
      <div role="tablist" className="mx-5 grid grid-cols-4 gap-1 rounded-[14px] bg-[#E4EAE8] p-1">
        {JENIS.map((j) => (
          <button
            key={j.id}
            role="tab"
            type="button"
            aria-selected={jenis === j.id}
            onClick={() => {
              setJenis(j.id);
              setOk(false);
            }}
            className={`h-10 rounded-[10px] text-sm ${jenis === j.id ? "bg-surface font-extrabold" : "font-semibold text-[#4A5A57]"}`}
          >
            {j.label}
          </button>
        ))}
      </div>
      <main className="flex grow flex-col gap-2.5 px-5 pt-3.5 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E3F1EE] text-sm font-extrabold text-primary">{i + 1}</span>
            <div className="flex grow flex-col gap-0.5">
              <b className="text-[15px] font-bold">{namaPeringkat(s.name)}</b>
              <span className="text-xs leading-snug text-muted">{keterangan(s, nama, jenis)}</span>
            </div>
            <button type="button" aria-label={`Ubah peringkat ${i + 1}`} onClick={() => setUbah(i)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#4A5A57]">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        ))}
        {d.data && steps.length < 6 && (
          <button
            type="button"
            onClick={() => {
              set([...steps, { name: "CEO", approver: "role", approver_role: "ceo", approver_person_id: null, condition: {}, skip_if_requester: true }]);
              setUbah(steps.length);
            }}
            className="h-12 rounded-[14px] border-2 border-dashed border-[#C9D3D1] text-sm font-bold text-primary"
          >
            + Tambah peringkat
          </button>
        )}

        {d.data?.w && (
          <div className="mt-1 flex flex-col rounded-card bg-surface px-4 py-1 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            <div className="flex flex-col gap-0.5 py-3">
              <b className="font-bold">{d.data.w.sla === "none" ? "Tiada tempoh sasaran" : "Selesai hari yang sama"}</b>
              <span className="text-xs text-muted">
                Permohonan selepas {d.data.w.cutoff_time.slice(0, 5) === "17:00" ? "5:00 ptg" : d.data.w.cutoff_time.slice(0, 5)} dikira pada hari bekerja berikutnya
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-3">
              <b className="font-bold">Peringatan kepada pelulus</b>
              <span className="text-muted">setiap {d.data.w.reminder_every_hours} jam</span>
            </div>
            {jenis === "leave" && d.data.kecuali.length > 0 && (
              <div className="flex items-center justify-between gap-2 py-3">
                <b className="font-bold">Dikecualikan daripada tempoh sasaran</b>
                <span className="text-right text-muted">{d.data.kecuali.join(", ")}</span>
              </div>
            )}
          </div>
        )}
        <span className="text-xs text-muted">Tiada kelulusan automatik. Perubahan terpakai kepada permohonan baharu dan peringkat seterusnya bagi permohonan yang sedang berjalan.</span>
        {ralat && <ErrorBox message={ralat} />}
        {ok && <span className="text-sm font-semibold text-success">Aliran kelulusan disimpan.</span>}
      </main>
      {draf?.jenis === jenis && (
        <div className="sticky bottom-0 border-t border-line-soft bg-surface px-5 pt-3 pb-7">
          <ButangUtama onClick={simpan} busy={busy}>
            Simpan aliran
          </ButangUtama>
        </div>
      )}
      {ubah !== null && steps[ubah] && (
        <UbahPeringkat
          s={steps[ubah]}
          n={ubah + 1}
          ppl={d.data?.ppl ?? []}
          jenis={jenis}
          onClose={() => setUbah(null)}
          onSave={(s) => {
            set(steps.map((x, i) => (i === ubah ? s : x)));
            setUbah(null);
          }}
          onDelete={
            steps.length > 1
              ? () => {
                  set(steps.filter((_, i) => i !== ubah));
                  setUbah(null);
                }
              : undefined
          }
          onUp={
            ubah > 0
              ? () => {
                  const c = [...steps];
                  [c[ubah - 1], c[ubah]] = [c[ubah], c[ubah - 1]];
                  set(c);
                  setUbah(null);
                }
              : undefined
          }
        />
      )}
    </Screen>
  );
}

function UbahPeringkat({
  s,
  n,
  ppl,
  jenis,
  onClose,
  onSave,
  onDelete,
  onUp,
}: {
  s: Peringkat;
  n: number;
  ppl: { person_id: string; name: string }[];
  jenis: ReqType;
  onClose: () => void;
  onSave: (s: Peringkat) => void;
  onDelete?: () => void;
  onUp?: () => void;
}) {
  const [f, setF] = useState<Peringkat>(s);
  const pilihan = f.approver === "role" ? `role:${f.approver_role}` : f.approver;
  const medanSyarat = jenis === "claim" || jenis === "payroll_run" ? "amount" : jenis === "leave" ? "days" : null;
  return (
    <Lembaran title={`Peringkat ${n}`} onClose={onClose}>
      <MedanBorang label="Nama peringkat">
        <input className={inputKecil} value={namaPeringkat(f.name)} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </MedanBorang>
      <MedanBorang label="Pelulus">
        <select
          className={inputKecil}
          value={pilihan}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("role:")) setF({ ...f, approver: "role", approver_role: v.slice(5), approver_person_id: null });
            else setF({ ...f, approver: v as Peringkat["approver"], approver_role: null, approver_person_id: v === "specific_person" ? (ppl[0]?.person_id ?? null) : null });
          }}
        >
          <option value="dept_head">Ketua Jabatan pemohon</option>
          <option value="direct_manager">Pengurus terus pemohon</option>
          <option value="role:hr">Peranan HR</option>
          <option value="role:finance">Peranan Kewangan</option>
          <option value="role:ceo">Peranan CEO</option>
          <option value="specific_person">Pekerja tertentu</option>
        </select>
      </MedanBorang>
      {f.approver === "specific_person" && (
        <MedanBorang label="Pekerja">
          <select className={inputKecil} value={f.approver_person_id ?? ""} onChange={(e) => setF({ ...f, approver_person_id: e.target.value })}>
            {ppl.map((p) => (
              <option key={p.person_id} value={p.person_id}>
                {p.name}
              </option>
            ))}
          </select>
        </MedanBorang>
      )}
      {medanSyarat && (
        <MedanBorang label={medanSyarat === "amount" ? "Hanya jika jumlah melebihi (RM)" : "Hanya jika tempoh melebihi (hari)"} nota="Kosong = semua permohonan">
          <input
            className={inputKecil}
            inputMode="decimal"
            value={f.condition?.value ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setF({ ...f, condition: v ? { field: medanSyarat, op: ">", value: Number(v) } : {} });
            }}
          />
        </MedanBorang>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-primary" checked={f.skip_if_requester} onChange={(e) => setF({ ...f, skip_if_requester: e.target.checked })} />
        Langkau jika pelulus sendiri yang memohon
      </label>
      <ButangUtama onClick={() => onSave(f)}>Guna</ButangUtama>
      <div className="grid grid-cols-2 gap-2">
        {onUp && (
          <button type="button" onClick={onUp} className="h-11 rounded-[12px] border border-line text-sm font-bold">
            Naikkan ke atas
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="h-11 rounded-[12px] border border-danger text-sm font-bold text-danger">
            Buang peringkat
          </button>
        )}
      </div>
    </Lembaran>
  );
}
