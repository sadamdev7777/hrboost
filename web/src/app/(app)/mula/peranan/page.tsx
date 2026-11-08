"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe, useMeContext } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getSenaraiPekerja } from "@/lib/hr";
import { selesaiLangkah } from "@/lib/mula";
import { ErrorBox, Loading } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Suis, inputKecil } from "@/components/Senarai";
import { MulaLayout } from "@/components/MulaLayout";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["app_role"];
const PERANAN: { role: Role; label: string; sub: string }[] = [
  { role: "hr", label: "HR", sub: "Menyemak cuti, mengurus pekerja" },
  { role: "finance", label: "Kewangan", sub: "Meluluskan tuntutan, menyemak gaji" },
  { role: "ceo", label: "Pengurusan / CEO", sub: "Kelulusan akhir" },
];

// Rujukan reka bentuk: design/SyarikatPeranan.dc.html
export default function PerananPage() {
  return (
    <HadPeranan roles={["admin"]} back="/mula">
      <Peranan />
    </HadPeranan>
  );
}

function Peranan() {
  const me = useMe();
  const ctx = useMeContext();
  const cid = me.active!.companyId;
  const router = useRouter();
  const d = useData(async () => {
    const sb = getSupabase();
    const [ppl, wf] = await Promise.all([
      getSenaraiPekerja(cid),
      sb
        .from("approval_workflows")
        .select("request_type, approval_workflow_steps(step_order, name, approver, approver_role, approver_person_id, condition, skip_if_requester)")
        .eq("company_id", cid),
    ]);
    return { ppl, wf: must(wf) ?? [] };
  }, [cid]);
  const [tambah, setTambah] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : <Loading />;

  const cuti = d.data.wf.find((w) => w.request_type === "leave");
  const langkahCuti = [...(cuti?.approval_workflow_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
  const ceo = langkahCuti.some((s) => s.approver === "role" && s.approver_role === "ceo");
  const finance = d.data.ppl.some((p) => p.roles.includes("finance"));

  async function togolCeo(on: boolean) {
    setRalat(null);
    const steps = on
      ? [...langkahCuti, { name: "CEO", approver: "role", approver_role: "ceo", approver_person_id: null, condition: {}, skip_if_requester: true }]
      : langkahCuti.filter((s) => !(s.approver === "role" && s.approver_role === "ceo"));
    try {
      must(await getSupabase().rpc("save_workflow", { p_company: cid, p_type: "leave", p_steps: steps as never }));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await selesaiLangkah(cid, "roles");
      ctx.reload();
      router.push("/mula/jemput");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }

  return (
    <MulaLayout
      n={5}
      title="Siapa meluluskan apa?"
      back="/mula/jabatan"
      footer={
        <ButangUtama onClick={simpan} busy={busy}>
          Simpan &amp; seterusnya
        </ButangUtama>
      }
    >
      <span className="text-sm leading-normal text-subtle">Tetapkan peranan. Aliran kelulusan telah disediakan — anda hanya perlu menyemak.</span>
      <Seksyen>PERANAN</Seksyen>
      <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {PERANAN.map((r) => {
          const orang = d.data!.ppl.filter((p) => p.roles.includes(r.role));
          return (
            <div key={r.role} className="flex min-h-[52px] items-center gap-2 py-2">
              <span className="flex grow flex-col gap-0.5">
                <b className="text-sm font-bold">{r.label}</b>
                <span className="text-xs text-muted">{r.sub}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {orang.map((p) => (
                  <span key={p.id} className="rounded-full bg-[#E3F1EE] px-2.5 py-1 text-xs font-bold text-primary">
                    {p.personId === me.personId ? "Anda" : p.name}
                  </span>
                ))}
                {orang.length === 0 && <span className="text-xs text-warning">Belum ditetapkan</span>}
              </span>
              <button type="button" aria-label={`Tambah ${r.label}`} onClick={() => setTambah(r.role)} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-lg font-bold text-primary">
                +
              </button>
            </div>
          );
        })}
      </div>

      <Seksyen className="pt-1">ALIRAN KELULUSAN</Seksyen>
      <div className="flex flex-col rounded-card bg-surface px-4 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        <div className="flex min-h-12 items-center gap-2">
          <span className="w-[90px] shrink-0 font-bold">Cuti</span>
          <span className="grow text-[13px] text-[#4A5A57]">Ketua → HR{ceo ? " → CEO" : ""}</span>
          <Suis on={ceo} label={ceo ? "Buang peringkat CEO untuk cuti" : "Tambah peringkat CEO untuk cuti"} onChange={togolCeo} />
        </div>
        <div className="flex min-h-12 items-center gap-2">
          <span className="w-[90px] shrink-0 font-bold">Tuntutan</span>
          <span className="grow text-[13px] text-[#4A5A57]">Ketua → Kewangan → CEO jika &gt; RM1,000</span>
        </div>
        <div className="flex min-h-12 items-center gap-2">
          <span className="w-[90px] shrink-0 font-bold">Betul masa &amp; Gaji</span>
          <span className="grow text-[13px] text-[#4A5A57]">Ketua · Kewangan → CEO</span>
        </div>
      </div>
      {!finance && <span className="rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning">Tetapkan sekurang-kurangnya seorang Kewangan untuk meluluskan tuntutan dan gaji.</span>}
      <span className="text-xs text-muted">Cuti melalui {ceo ? 3 : 2} peringkat dan selesai pada hari yang sama. Semua tetapan boleh diubah kemudian di Tetapan.</span>
      {ralat && <ErrorBox message={ralat} />}
      {tambah && (
        <TambahPeranan
          cid={cid}
          role={tambah}
          ppl={d.data.ppl.filter((p) => !p.roles.includes(tambah))}
          onClose={() => setTambah(null)}
          onDone={() => {
            setTambah(null);
            d.reload();
          }}
        />
      )}
    </MulaLayout>
  );
}

function TambahPeranan({ cid, role, ppl, onClose, onDone }: { cid: string; role: Role; ppl: { personId: string; name: string; employeeNo: string }[]; onClose: () => void; onDone: () => void }) {
  const [orang, setOrang] = useState(ppl[0]?.personId ?? "");
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    try {
      must(await getSupabase().from("user_roles").insert({ company_id: cid, person_id: orang, role }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }
  return (
    <Lembaran title={`Tambah ${PERANAN.find((r) => r.role === role)?.label}`} onClose={onClose}>
      {ppl.length === 0 ? (
        <span className="text-sm text-muted">Semua pekerja sudah mempunyai peranan ini.</span>
      ) : (
        <MedanBorang label="Pekerja">
          <select className={inputKecil} value={orang} onChange={(e) => setOrang(e.target.value)}>
            {ppl.map((p) => (
              <option key={p.personId} value={p.personId}>
                {p.name} · {p.employeeNo}
              </option>
            ))}
          </select>
        </MedanBorang>
      )}
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} disabled={!ppl.length}>
        Tambah
      </ButangUtama>
    </Lembaran>
  );
}
