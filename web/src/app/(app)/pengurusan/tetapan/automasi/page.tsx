"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Cip, HadPeranan, Seksyen, Suis, Tag } from "@/components/Senarai";
import type { Database } from "@/lib/database.types";

type Target = Database["public"]["Enums"]["notify_target"];

const BILA: Record<string, string> = {
  "leave.submitted": "Cuti dimohon",
  "leave.approved": "Cuti diluluskan",
  "attendance.late": "Lewat masuk",
  "approval.task_assigned": "Tiba di peringkat pelulus",
  "approval.reminder": "Peringatan berkala",
  "approval.approved": "Permohonan diluluskan",
  "approval.rejected": "Permohonan ditolak",
  "approval.returned": "Permohonan dikembalikan",
  "approval.sla_breached": "Melepasi tempoh sasaran",
  "profile.bank_change_requested": "Tukar akaun bank dimohon",
  "employment.ended": "Pekerjaan tamat",
};
const KEPADA: { id: Target; label: string }[] = [
  { id: "subject", label: "Pekerja berkenaan" },
  { id: "cover_person", label: "Pengganti tugas" },
  { id: "subject_dept_head", label: "Ketua jabatan" },
  { id: "subject_manager", label: "Pengurus terus" },
  { id: "dept_peers", label: "Rakan sejabatan" },
  { id: "role_hr", label: "HR" },
  { id: "role_ceo", label: "CEO" },
];
const PEMBOLEH: Record<string, string[]> = {
  "leave.submitted": ["nama", "jabatan", "jenis", "tarikh", "days", "pic", "status"],
  "leave.approved": ["nama", "jabatan", "jenis", "tarikh", "days", "pic"],
  "attendance.late": ["nama", "clock_in", "late_minutes", "late_count_month"],
  default: ["nama", "title"],
};

// Rujukan reka bentuk: design/Automasi.dc.html
export default function AutomasiPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Automasi />
    </HadPeranan>
  );
}

type Rule = { id: string; name: string; event_type: string; target: Target; message_template: string; active: boolean; condition: unknown };

function Automasi() {
  const me = useMe();
  const cid = me.active!.companyId;
  const d = useData(
    async () =>
      (must(await getSupabase().from("automation_rules").select("id, name, event_type, target, message_template, active, condition").eq("company_id", cid).order("created_at")) ??
        []) as Rule[],
    [cid],
  );
  const [pilih, setPilih] = useState<string | null>(null);
  const [draf, setDraf] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const rules = d.data ?? [];
  const asal = rules.find((r) => r.id === pilih) ?? rules[0];
  const cur = draf && draf.id === asal?.id ? draf : asal;

  async function kemas(id: string, patch: Partial<Pick<Rule, "active" | "target" | "message_template">>) {
    setRalat(null);
    try {
      must(await getSupabase().from("automation_rules").update(patch).eq("id", id));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function simpan() {
    if (!cur) return;
    if (!cur.message_template.trim()) return setRalat("Mesej tidak boleh kosong.");
    setBusy(true);
    await kemas(cur.id, { target: cur.target, message_template: cur.message_template.trim() });
    setDraf(null);
    setBusy(false);
  }

  const vars = cur ? (PEMBOLEH[cur.event_type] ?? PEMBOLEH.default) : [];

  return (
    <Screen lebar="sederhana">
      <BackHeader title="Automasi WhatsApp" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <RingkasanHarian cid={cid} />
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {cur && (
          <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <b className="text-sm font-extrabold">{cur.name}</b>
              <Tag tone={cur.active ? "success" : "neutral"}>{cur.active ? "Aktif" : "Tidak aktif"}</Tag>
            </div>
            <Seksyen>APABILA</Seksyen>
            <div className="flex flex-wrap gap-1.5">
              <Cip on onClick={() => {}}>
                {BILA[cur.event_type] ?? cur.event_type}
              </Cip>
              {(cur.condition as { field?: string; value?: number })?.field === "late_count_month" && (
                <Cip on onClick={() => {}}>
                  Lewat kali ke-{(cur.condition as { value: number }).value}
                </Cip>
              )}
            </div>
            <Seksyen>HANTAR KEPADA</Seksyen>
            <div className="flex flex-wrap gap-1.5">
              {KEPADA.map((k) => (
                <Cip key={k.id} on={cur.target === k.id} onClick={() => setDraf({ ...cur, target: k.id })}>
                  {k.label}
                </Cip>
              ))}
            </div>
            <Seksyen>MESEJ</Seksyen>
            <textarea
              aria-label="Mesej WhatsApp"
              value={cur.message_template}
              onChange={(e) => setDraf({ ...cur, message_template: e.target.value })}
              rows={5}
              className="rounded-[12px] border border-[#D5DEDC] bg-page px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <span className="text-xs text-muted">Pemboleh ubah: {vars.map((v) => `{{${v}}}`).join(" ")}</span>
            {cur.event_type === "leave.submitted" && cur.target === "cover_person" && (
              <span className="rounded-[12px] bg-warning-soft px-3 py-2 text-xs leading-normal text-warning">
                Ketua jabatan tidak dihantar mesej ini kerana telah menerima mesej kelulusan — bagi mengelakkan mesej berulang.
              </span>
            )}
            {draf && draf.id === cur.id && (
              <ButangUtama onClick={simpan} busy={busy}>
                Simpan peraturan
              </ButangUtama>
            )}
          </div>
        )}
        {ralat && <ErrorBox message={ralat} />}
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPilih(r.id);
                  setDraf(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex min-h-12 grow flex-col justify-center gap-0.5 py-2 text-left ${cur?.id === r.id ? "text-primary" : ""}`}
              >
                <b className="text-sm font-bold">{r.name}</b>
                <span className="text-xs text-muted">
                  {BILA[r.event_type] ?? r.event_type} · {KEPADA.find((k) => k.id === r.target)?.label ?? r.target}
                </span>
              </button>
              <Suis on={r.active} label={`${r.active ? "Matikan" : "Hidupkan"} ${r.name}`} onChange={(v) => kemas(r.id, { active: v })} />
            </div>
          ))}
        </div>
      </main>
    </Screen>
  );
}

/** Ringkasan harian WhatsApp kepada HR (5:00 petang, hari bekerja). */
function RingkasanHarian({ cid }: { cid: string }) {
  const d = useData(async () => {
    const sb = getSupabase();
    const [c, pr] = await Promise.all([
      sb.from("companies").select("hr_daily_digest").eq("id", cid).maybeSingle(),
      sb.rpc("my_daily_digest_preview", { p_company: cid }),
    ]);
    return { on: (must(c) as { hr_daily_digest?: boolean } | null)?.hr_daily_digest ?? true, pratonton: (must(pr) as string | null) ?? null };
  }, [cid]);
  const [lihat, setLihat] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : null;
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-extrabold">Ringkasan harian kepada HR</b>
          <span className="text-xs leading-snug text-muted">WhatsApp setiap hari bekerja jam 5:00 petang: kelulusan tertangguh, siapa tiada, pekerja baharu esok, tarikh akhir berkanun. Tidak dihantar jika tiada apa-apa.</span>
        </span>
        <Suis
          on={d.data.on}
          label="Ringkasan harian kepada HR"
          onChange={async (v) => {
            setRalat(null);
            try {
              must(await getSupabase().rpc("set_hr_daily_digest", { p_company: cid, p_on: v }));
              d.reload();
            } catch (e) {
              setRalat(e instanceof Error ? e.message : "Ralat");
            }
          }}
        />
      </div>
      <button type="button" onClick={() => setLihat(!lihat)} className="self-start py-1 text-[13px] font-bold text-primary">
        {lihat ? "Sembunyikan pratonton" : "Pratonton mesej hari ini"}
      </button>
      {lihat && (
        <pre className="m-0 rounded-[12px] bg-[#E7F6E9] px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
          {d.data.pratonton ?? "Tiada perkara untuk dilaporkan hari ini — mesej tidak akan dihantar."}
        </pre>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
