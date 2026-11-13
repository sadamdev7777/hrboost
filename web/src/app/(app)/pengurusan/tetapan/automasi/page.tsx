"use client";

import { tr, trRalat } from "@/lib/i18n";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { setSaluran, useSaluran } from "@/lib/saluran";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, Cip, HadPeranan, Seksyen, Suis, Tag, GrupLajur } from "@/components/Senarai";
import type { Database } from "@/lib/database.types";

type Target = Database["public"]["Enums"]["notify_target"];

const BILA: Record<string, string> = {
  "leave.submitted": tr("Cuti dimohon"),
  "leave.approved": tr("Cuti diluluskan"),
  "attendance.late": tr("Lewat masuk"),
  "approval.task_assigned": tr("Tiba di peringkat pelulus"),
  "approval.reminder": tr("Peringatan berkala"),
  "approval.approved": tr("Permohonan diluluskan"),
  "approval.rejected": tr("Permohonan ditolak"),
  "approval.returned": tr("Permohonan dikembalikan"),
  "approval.sla_breached": tr("Melepasi tempoh sasaran"),
  "profile.bank_change_requested": tr("Tukar akaun bank dimohon"),
  "employment.ended": tr("Pekerjaan tamat"),
};
const KEPADA: { id: Target; label: string }[] = [
  { id: "subject", label: tr("Pekerja berkenaan") },
  { id: "cover_person", label: tr("Pengganti tugas") },
  { id: "subject_dept_head", label: tr("Ketua jabatan") },
  { id: "subject_manager", label: tr("Pengurus terus") },
  { id: "dept_peers", label: tr("Rakan sejabatan") },
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
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  async function simpan() {
    if (!cur) return;
    if (!cur.message_template.trim()) return setRalat(tr("Mesej tidak boleh kosong."));
    setBusy(true);
    await kemas(cur.id, { target: cur.target, message_template: cur.message_template.trim() });
    setDraf(null);
    setBusy(false);
  }

  const vars = cur ? (PEMBOLEH[cur.event_type] ?? PEMBOLEH.default) : [];

  return (
    <Screen lebar="lebar">
      <BackHeader title={tr("Notifikasi & automasi")} href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        <GrupLajur>
        <SaluranNotifikasi cid={cid} />
        <RingkasanHarian cid={cid} />
        <LaporanBulanan cid={cid} />
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {cur && (
          <div className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <b className="text-sm font-extrabold">{trRalat(cur.name)}</b>
              <Tag tone={cur.active ? "success" : "neutral"}>{cur.active ? tr("Aktif") : tr("Tidak aktif")}</Tag>
            </div>
            <Seksyen>{tr("APABILA")}</Seksyen>
            <div className="flex flex-wrap gap-1.5">
              <Cip on onClick={() => {}}>
                {BILA[cur.event_type] ?? cur.event_type}
              </Cip>
              {(cur.condition as { field?: string; value?: number })?.field === "late_count_month" && (
                <Cip on onClick={() => {}}>
                  {tr("Lewat kali ke-{0}", (cur.condition as { value: number }).value)}</Cip>
              )}
            </div>
            <Seksyen>{tr("HANTAR KEPADA")}</Seksyen>
            <div className="flex flex-wrap gap-1.5">
              {KEPADA.map((k) => (
                <Cip key={k.id} on={cur.target === k.id} onClick={() => setDraf({ ...cur, target: k.id })}>
                  {tr(k.label)}
                </Cip>
              ))}
            </div>
            <Seksyen>{tr("MESEJ")}</Seksyen>
            <textarea
              aria-label={tr("Mesej WhatsApp")}
              value={cur.message_template}
              onChange={(e) => setDraf({ ...cur, message_template: e.target.value })}
              rows={5}
              className="rounded-[12px] border border-[#D5DEDC] bg-page px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary"
            />
            <span className="text-xs text-muted">{tr("Pemboleh ubah: {0}", vars.map((v) => `{{${v}}}`).join(" "))}</span>
            {cur.event_type === "leave.submitted" && cur.target === "cover_person" && (
              <span className="rounded-[12px] bg-warning-soft px-3 py-2 text-xs leading-normal text-warning">
                {tr("Ketua jabatan tidak dihantar mesej ini kerana telah menerima mesej kelulusan — bagi mengelakkan mesej berulang.")}</span>
            )}
            {draf && draf.id === cur.id && (
              <ButangUtama onClick={simpan} busy={busy}>
                {tr("Simpan peraturan")}</ButangUtama>
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
                <b className="text-sm font-bold">{trRalat(r.name)}</b>
                <span className="text-xs text-muted">
                  {BILA[r.event_type] ?? r.event_type} · {KEPADA.find((k) => k.id === r.target)?.label ?? r.target}
                </span>
              </button>
              <Suis on={r.active} label={`${r.active ? tr("Matikan") : tr("Hidupkan")} ${r.name}`} onChange={(v) => kemas(r.id, { active: v })} />
            </div>
          ))}
        </div>
        </GrupLajur>
      </main>
    </Screen>
  );
}

/** Ringkasan harian WhatsApp kepada HR (5:00 petang, hari bekerja). */
/** Saluran notifikasi syarikat: loceng (sentiasa), WhatsApp (Murpati, pilihan), e-mel (pilihan). */
function SaluranNotifikasi({ cid }: { cid: string }) {
  const s = useSaluran(cid);
  const [ralat, setRalat] = useState<string | null>(null);
  async function tukar(wa: boolean, emel: boolean) {
    setRalat(null);
    try {
      await setSaluran(cid, wa, emel);
      s.reload();
    } catch (e) {
      setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
    }
  }
  if (s.muat) return null;
  const baris: [string, string, boolean, boolean, (v: boolean) => void][] = [
    [tr("WhatsApp"), s.whatsapp_ready ? tr("Mesej automatik kepada pekerja yang mempunyai no. WhatsApp.") : tr("Belum disambung. Jemputan dan peringatan masih boleh dihantar dari WhatsApp anda sendiri."), s.whatsapp_ready, s.company_whatsapp, (v) => tukar(v, s.company_email)],
    [tr("E-mel"), s.email_ready ? tr("Dihantar jika WhatsApp tidak aktif atau pekerja tiada no. WhatsApp.") : tr("Belum disambung oleh Pentadbir Platform."), s.email_ready, s.company_email, (v) => tukar(s.company_whatsapp, v)],
  ];
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
      <b className="text-sm font-extrabold">{tr("Saluran notifikasi")}</b>
      <span className="text-xs leading-snug text-muted">{tr("Semua notifikasi sentiasa dipaparkan pada loceng dalam aplikasi. WhatsApp dan e-mel ialah saluran tambahan.")}</span>
      {baris.map(([nama, nota, sedia, hidup, ubah]) => (
        <div key={nama} className="flex min-h-12 items-center gap-3 border-t border-[#EEF2F1] pt-2">
          <span className="flex grow flex-col gap-0.5">
            <b className="text-sm">{nama}</b>
            <span className="text-xs leading-snug text-muted">{nota}</span>
          </span>
          {sedia ? <Suis on={hidup} label={nama} onChange={ubah} /> : <span className="text-xs font-bold text-muted">{tr("Tidak aktif")}</span>}
        </div>
      ))}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}

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
          <b className="text-sm font-extrabold">{tr("Ringkasan harian kepada HR")}</b>
          <span className="text-xs leading-snug text-muted">{tr("Dihantar setiap hari bekerja jam 5:00 petang: kelulusan tertangguh, siapa tiada, pekerja baharu esok, tarikh akhir berkanun. Tidak dihantar jika tiada apa-apa.")}</span>
        </span>
        <Suis
          on={d.data.on}
          label={tr("Ringkasan harian kepada HR")}
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
      <button type="button" onClick={() => setLihat(!lihat)} className="flex min-h-11 items-center self-start text-[13px] font-bold text-primary">
        {lihat ? tr("Sembunyikan pratonton") : tr("Pratonton mesej hari ini")}
      </button>
      {lihat && (
        <pre className="m-0 rounded-[12px] bg-[#E7F6E9] px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
          {d.data.pratonton ?? tr("Tiada perkara untuk dilaporkan hari ini — mesej tidak akan dihantar.")}
        </pre>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}

/** Laporan bulanan WhatsApp kepada CEO (1 haribulan, 9:00 pagi). Agregat sahaja. */
function LaporanBulanan({ cid }: { cid: string }) {
  const d = useData(async () => {
    const sb = getSupabase();
    const [c, pr] = await Promise.all([
      sb.from("companies").select("ceo_monthly_report").eq("id", cid).maybeSingle(),
      sb.rpc("ceo_monthly_report_preview", { p_company: cid }),
    ]);
    return { on: (must(c) as { ceo_monthly_report?: boolean } | null)?.ceo_monthly_report ?? true, pratonton: (must(pr) as string | null) ?? null };
  }, [cid]);
  const [lihat, setLihat] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : null;
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex grow flex-col gap-0.5">
          <b className="text-sm font-extrabold">{tr("Laporan bulanan kepada CEO")}</b>
          <span className="text-xs leading-snug text-muted">
            {tr("Dihantar pada 1 haribulan jam 9:00 pagi: bilangan pekerja, kos gaji berbanding bulan lepas, cuti, MC, tuntutan dan kelulusan. Angka keseluruhan sahaja, tiada maklumat individu.")}
          </span>
        </span>
        <Suis
          on={d.data.on}
          label={tr("Laporan bulanan kepada CEO")}
          onChange={async (v) => {
            setRalat(null);
            try {
              must(await getSupabase().rpc("set_ceo_monthly_report", { p_company: cid, p_on: v }));
              d.reload();
            } catch (e) {
              setRalat(e instanceof Error ? trRalat(e.message) : tr("Ralat"));
            }
          }}
        />
      </div>
      <button type="button" onClick={() => setLihat(!lihat)} className="flex min-h-11 items-center self-start text-[13px] font-bold text-primary">
        {lihat ? tr("Sembunyikan pratonton") : tr("Pratonton laporan bulan lepas")}
      </button>
      {lihat && d.data.pratonton && (
        <pre className="m-0 rounded-[12px] bg-[#E7F6E9] px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{d.data.pratonton}</pre>
      )}
      {ralat && <ErrorBox message={ralat} />}
    </div>
  );
}
