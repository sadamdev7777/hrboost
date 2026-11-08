"use client";

import { useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getSenaraiPekerja, LABEL_PERANAN } from "@/lib/hr";
import { inisial, tarikh } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ButangUtama, HadPeranan, Lembaran, MedanBorang, Seksyen, Tag, inputKecil } from "@/components/Senarai";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["app_role"];
const PERANAN_KHAS: Role[] = ["admin", "hr", "finance", "ceo"];

// Rujukan reka bentuk: design/T_Pengguna.dc.html
export default function PenggunaPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/tetapan">
      <Pengguna />
    </HadPeranan>
  );
}

function Pengguna() {
  const me = useMe();
  const emp = me.active!;
  const admin = me.roles.includes("admin");
  const d = useData(async () => {
    const [ppl, luar] = await Promise.all([
      getSenaraiPekerja(emp.companyId),
      admin ? getSupabase().rpc("company_external_access", { p_company: emp.companyId }) : Promise.resolve({ data: [], error: null }),
    ]);
    return { ppl, luar: must(luar) ?? [] };
  }, [emp.companyId, admin]);
  const [beri, setBeri] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const khas = (d.data?.ppl ?? []).filter((p) => p.isHead || p.roles.some((r) => PERANAN_KHAS.includes(r as Role)));

  async function buang(personId: string, role: string, nama: string) {
    if (!window.confirm(`Tarik balik peranan ${LABEL_PERANAN[role]} daripada ${nama}?`)) return;
    setRalat(null);
    try {
      must(await getSupabase().from("user_roles").delete().eq("company_id", emp.companyId).eq("person_id", personId).eq("role", role as Role));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  async function tarikBalik(id: string) {
    if (!window.confirm("Tarik balik akses ini?")) return;
    try {
      must(await getSupabase().rpc("revoke_company_access", { p_grant: id }));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
    }
  }

  return (
    <Screen>
      <BackHeader title="Pengguna & peranan" href="/pengurusan/tetapan" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        <div className="rounded-[14px] bg-[#E3F1EE] px-4 py-3 text-[13px] leading-normal text-primary">
          Semua pekerja {emp.companyCode} ialah pengguna biasa. Di sini anda boleh memberikan peranan tambahan. Peranan hanya boleh diberikan kepada pekerja syarikat ini.
        </div>
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        <Seksyen>PERANAN KHAS</Seksyen>
        <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
          {khas.map((p) => (
            <div key={p.id} className="flex min-h-12 flex-wrap items-center gap-2 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E3F1EE] text-xs font-extrabold text-primary">{inisial(p.name)}</span>
              <b className="grow text-sm font-bold">{p.name}</b>
              <span className="flex flex-wrap justify-end gap-1">
                {p.roles
                  .filter((r) => PERANAN_KHAS.includes(r as Role))
                  .map((r) =>
                    admin && !(p.personId === me.personId && r === "admin") ? (
                      <button key={r} type="button" onClick={() => buang(p.personId, r, p.name)} aria-label={`Tarik balik ${LABEL_PERANAN[r]} daripada ${p.name}`} className="flex min-h-9 items-center">
                        <Tag tone="primary">{LABEL_PERANAN[r]} ×</Tag>
                      </button>
                    ) : (
                      <Tag key={r} tone="primary">
                        {LABEL_PERANAN[r]}
                      </Tag>
                    ),
                  )}
                {p.isHead && <Tag tone="neutral">Ketua {p.department}</Tag>}
              </span>
            </div>
          ))}
        </div>
        {admin ? (
          <button type="button" onClick={() => setBeri(true)} className="h-12 rounded-[14px] border-2 border-dashed border-[#C9D3D1] text-sm font-bold text-primary">
            + Berikan peranan
          </button>
        ) : (
          <span className="text-xs text-muted">Hanya Pentadbir syarikat boleh memberi atau menarik balik peranan.</span>
        )}

        {admin && (
          <>
            <Seksyen className="pt-1">AKSES DARI LUAR SYARIKAT</Seksyen>
            <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
              {(d.data?.luar ?? []).length === 0 && <span className="py-3 text-sm text-muted">Tiada akses dari luar.</span>}
              {(d.data?.luar ?? []).map((g) => (
                <div key={g.id} className="flex min-h-12 items-center gap-2 py-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EDE9F8] text-xs font-extrabold text-ai">{inisial(g.name)}</span>
                  <span className="flex grow flex-col gap-0.5">
                    <b className="text-sm font-bold">{g.name}</b>
                    <span className="text-xs text-muted">
                      {[g.home_company, `paparan ${LABEL_PERANAN[g.role] ?? g.role}`, g.status === "pending" ? "menunggu kelulusan" : g.expires_at ? `tamat ${tarikh(g.expires_at)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {g.status === "approved" && (
                    <button type="button" onClick={() => tarikBalik(g.id)} className="min-h-11 text-[13px] font-bold text-danger">
                      Tarik balik
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {ralat && <ErrorBox message={ralat} />}
        <span className="text-xs text-muted">Akses dari luar hanya melalui kelulusan Pentadbir Platform HRBoost. Anda akan dimaklumkan setiap kali terdapat permohonan.</span>
      </main>
      {beri && d.data && (
        <BeriPeranan
          cid={emp.companyId}
          ppl={d.data.ppl.map((p) => ({ personId: p.personId, name: p.name, roles: p.roles }))}
          onClose={() => setBeri(false)}
          onDone={() => {
            setBeri(false);
            d.reload();
          }}
        />
      )}
    </Screen>
  );
}

function BeriPeranan({ cid, ppl, onClose, onDone }: { cid: string; ppl: { personId: string; name: string; roles: string[] }[]; onClose: () => void; onDone: () => void }) {
  const [orang, setOrang] = useState(ppl[0]?.personId ?? "");
  const [peranan, setPeranan] = useState<Role>("hr");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  async function simpan() {
    setRalat(null);
    if (ppl.find((p) => p.personId === orang)?.roles.includes(peranan)) return setRalat("Pekerja ini sudah mempunyai peranan tersebut.");
    setBusy(true);
    try {
      must(await getSupabase().from("user_roles").insert({ company_id: cid, person_id: orang, role: peranan }));
      onDone();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : "Ralat");
      setBusy(false);
    }
  }
  return (
    <Lembaran title="Berikan peranan" onClose={onClose}>
      <MedanBorang label="Pekerja">
        <select className={inputKecil} value={orang} onChange={(e) => setOrang(e.target.value)}>
          {ppl.map((p) => (
            <option key={p.personId} value={p.personId}>
              {p.name}
            </option>
          ))}
        </select>
      </MedanBorang>
      <MedanBorang label="Peranan">
        <select className={inputKecil} value={peranan} onChange={(e) => setPeranan(e.target.value as Role)}>
          {PERANAN_KHAS.map((r) => (
            <option key={r} value={r}>
              {LABEL_PERANAN[r]}
            </option>
          ))}
        </select>
      </MedanBorang>
      <span className="text-xs text-muted">Ketua jabatan ditetapkan dalam Jabatan, bukan di sini.</span>
      {ralat && <ErrorBox message={ralat} />}
      <ButangUtama onClick={simpan} busy={busy}>
        Berikan
      </ButangUtama>
    </Lembaran>
  );
}
