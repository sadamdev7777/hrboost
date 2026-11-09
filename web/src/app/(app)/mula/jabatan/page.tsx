"use client";

import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getJabatan, getSenaraiPekerja } from "@/lib/hr";
import { selesaiLangkah } from "@/lib/mula";
import { inisial } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/ui";
import { ButangUtama, HadPeranan } from "@/components/Senarai";
import { BorangJabatan, PilihKetua } from "@/components/Jabatan";
import { MulaLayout } from "@/components/MulaLayout";

// Rujukan reka bentuk: design/SyarikatJabatan.dc.html
export default function JabatanPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/mula">
      <Jabatan />
    </HadPeranan>
  );
}

function Jabatan() {
  const me = useMe();
  const cid = me.active!.companyId;
  const router = useRouter();
  const d = useData(async () => {
    const [jab, ppl] = await Promise.all([getJabatan(cid), getSenaraiPekerja(cid)]);
    return { jab, ppl };
  }, [cid]);
  const [pilih, setPilih] = useState<string | null>(null);
  const [baru, setBaru] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  if (!d.data) return d.error ? <ErrorBox message={d.error} /> : <Loading />;
  const kira = (id: string) => d.data!.ppl.filter((p) => p.departmentId === id).length;
  const tanpaKetua = d.data.jab.filter((j) => !j.headPersonId && kira(j.id) > 0);

  async function simpan() {
    setBusy(true);
    setRalat(null);
    try {
      await selesaiLangkah(cid, "departments");
      router.push("/mula/peranan");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <MulaLayout
      n={4}
      title={tr("Jabatan & ketua")}
      back="/mula/import"
      footer={
        tanpaKetua.length ? (
          <button type="button" disabled className="h-12 w-full rounded-button bg-[#DCE3E1] text-base font-extrabold text-[#4A5A57]">
            {tr("{0} jabatan belum mempunyai ketua", tanpaKetua.length)}</button>
        ) : (
          <ButangUtama onClick={simpan} busy={busy}>
            {tr("Simpan & seterusnya")}</ButangUtama>
        )
      }
    >
      <span className="text-sm leading-normal text-subtle">{tr("Dicipta daripada fail Excel anda. Ketua jabatan akan menjadi pelulus pertama bagi pasukan mereka.")}</span>
      <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        {d.data.jab.length === 0 && <span className="py-3 text-sm text-muted">{tr("Belum ada jabatan.")}</span>}
        {d.data.jab.map((j) => (
          <div key={j.id} className="flex min-h-[52px] items-center gap-3 py-2">
            <span className="flex grow flex-col gap-0.5">
              <b className="text-sm font-bold">{j.name}</b>
              <span className={`text-xs ${!j.headPersonId && kira(j.id) ? "text-warning" : "text-muted"}`}>
                {tr("{0} pekerja{1}", kira(j.id), !j.headPersonId && kira(j.id) ? tr(" · tiada ketua") : "")}</span>
            </span>
            <button
              type="button"
              onClick={() => setPilih(j.id)}
              className={`flex h-10 items-center gap-2 rounded-full pr-3 pl-1 text-[13px] font-bold ${j.headPersonId ? "bg-[#E3F1EE] text-primary" : "border border-warning px-3 text-warning"}`}
            >
              {j.headPersonId ? (
                <>
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs text-white">{inisial(j.headName ?? "")}</span>
                  {j.headPersonId === me.personId ? tr("Anda") : j.headName}
                </>
              ) : (
                tr("Pilih ketua")
              )}
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setBaru(true)} className="h-12 rounded-[14px] border-2 border-dashed border-[#C9D3D1] text-sm font-bold text-primary">
        {tr("+ Tambah jabatan")}</button>
      <span className="text-xs leading-normal text-muted">{tr("Apabila ketua jabatan sendiri memohon cuti, permohonan akan terus dihantar ke peringkat seterusnya.")}</span>
      {ralat && <ErrorBox message={ralat} />}
      {pilih && (
        <PilihKetua
          jabatan={d.data.jab.find((j) => j.id === pilih)!}
          ppl={d.data.ppl}
          onClose={() => setPilih(null)}
          onDone={() => {
            setPilih(null);
            d.reload();
          }}
        />
      )}
      {baru && (
        <BorangJabatan
          cid={cid}
          onClose={() => setBaru(false)}
          onDone={() => {
            setBaru(false);
            d.reload();
          }}
        />
      )}
    </MulaLayout>
  );
}
