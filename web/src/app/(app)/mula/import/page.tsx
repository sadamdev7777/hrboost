"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";
import { bacaFailPekerja, templatCSV, type BarisImport } from "@/lib/import";
import { selesaiLangkah } from "@/lib/mula";
import { ErrorBox } from "@/components/ui";
import { ButangUtama, HadPeranan, Tag } from "@/components/Senarai";
import { MulaLayout } from "@/components/MulaLayout";

// Rujukan reka bentuk: design/ImportPekerja.dc.html
export default function ImportPekerjaPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/mula">
      <Import />
    </HadPeranan>
  );
}

function Import() {
  const me = useMe();
  const cid = me.active!.companyId;
  const router = useRouter();
  const fail = useRef<HTMLInputElement>(null);
  const [namaFail, setNamaFail] = useState<string | null>(null);
  const [rows, setRows] = useState<BarisImport[] | null>(null);
  const [semua, setSemua] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [gagal, setGagal] = useState<{ row: number; name: string; error: string }[]>([]);

  async function baca(f: File | undefined) {
    if (!f) return;
    setRalat(null);
    setGagal([]);
    try {
      const r = await bacaFailPekerja(f);
      setRows(r.rows);
      setNamaFail(f.name);
    } catch (e) {
      setRows(null);
      setRalat(e instanceof Error ? e.message : tr("Fail tidak dapat dibaca."));
    }
  }

  function templat() {
    const url = URL.createObjectURL(new Blob(["﻿" + templatCSV()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "templat-pekerja-hrboost.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function importkan() {
    if (!rows?.length) return;
    setBusy(true);
    setRalat(null);
    try {
      const r = must(
        await getSupabase().rpc("import_employees", {
          p_company: cid,
          p_rows: rows.map(({ issues, head_name, ...x }) => (void issues, void head_name, x)) as never,
        }),
      ) as unknown as { created: number; failed: { row: number; name: string; error: string }[] };
      if (r.failed.length) {
        setGagal(r.failed);
        setRows(rows.filter((_, i) => r.failed.some((f) => f.row === i + 1)));
        setBusy(false);
        if (r.created === 0) return;
      }
      if (!r.failed.length) router.push("/mula/jabatan");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  async function langkau() {
    await selesaiLangkah(cid, "import").catch(() => {});
    router.push("/mula/jabatan");
  }

  const perluSemak = (rows ?? []).filter((r) => r.issues.length > 0);
  const papar = semua ? (rows ?? []) : [...perluSemak, ...(rows ?? []).filter((r) => !r.issues.length)].slice(0, 4);

  return (
    <MulaLayout
      n={3}
      title={tr("Import pekerja")}
      back="/mula/syarikat"
      footer={
        rows?.length ? (
          <div className="flex flex-col gap-2">
            <ButangUtama onClick={importkan} busy={busy}>
              {tr("Import {0} pekerja", rows.length)}</ButangUtama>
            <span className="text-center text-xs text-muted">{tr("Ketua yang tiada akan ditetapkan pada langkah seterusnya. Jemputan belum dihantar.")}</span>
          </div>
        ) : undefined
      }
    >
      <button type="button" onClick={() => fail.current?.click()} className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-[#C9D3D1] bg-surface px-4 py-4">
        <b className="text-sm font-extrabold">{tr("Muat naik Excel sedia ada")}</b>
        <span className="text-[13px] text-muted">{namaFail ? `${namaFail} ✓` : tr(".xlsx atau .csv")}</span>
      </button>
      <input ref={fail} type="file" className="hidden" aria-label={tr("Pilih fail Excel pekerja")} accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => baca(e.target.files?.[0])} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={templat} className="h-11 rounded-[12px] border border-line bg-surface text-sm font-bold">
          {tr("Muat turun templat")}</button>
        <Link href="/pengurusan/pekerja/baru" className="flex h-11 items-center justify-center rounded-[12px] border border-line bg-surface text-sm font-bold text-ink!">
          {tr("Tambah seorang demi seorang")}</Link>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {gagal.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] text-danger">
          <b>{tr("{0} baris tidak diimport:", gagal.length)}</b>
          {gagal.map((g) => (
            <span key={g.row}>
              {g.name || tr("Baris {0}", g.row)}: {g.error}
            </span>
          ))}
          <button type="button" onClick={() => router.push("/mula/jabatan")} className="mt-1 self-start font-bold underline">
            {tr("Teruskan tanpa baris ini")}</button>
        </div>
      )}
      {rows && (
        <>
          <div className="rounded-[14px] bg-[#F3F0FC] px-4 py-3 text-[13px] leading-normal text-[#4A3B8C]">
            <b>{tr("Sistem menemui {0} pekerja.", rows.length)}</b> {" "}{tr("Lajur dipadankan secara automatik walaupun format Excel anda berbeza. {0}", perluSemak.length ? tr("{0} rekod perlu disemak.", perluSemak.length) : tr("Semua rekod lengkap."))}</div>
          <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {papar.map((r, i) => (
              <div key={i} className="flex min-h-12 items-center gap-2 py-2">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-sm font-bold">{r.full_name}</b>
                  <span className="text-xs text-muted">
                    {[r.department || tr("Tiada jabatan"), r.is_head ? tr("Ketua Jabatan") : r.head_name ? tr("ketua: {0}", r.head_name) : tr("ketua: —")].join(" · ")}
                  </span>
                </span>
                {r.issues.slice(0, 1).map((x) => (
                  <Tag key={x} tone="warning">
                    {x}
                  </Tag>
                ))}
              </div>
            ))}
          </div>
          {rows.length > 4 && (
            <button type="button" onClick={() => setSemua(!semua)} className="self-start text-sm font-bold text-primary">
              {semua ? tr("Ringkaskan") : tr("Lihat semua {0}", rows.length)}
            </button>
          )}
        </>
      )}
      {!rows && (
        <button type="button" onClick={langkau} className="self-start py-2 text-sm font-bold text-muted underline">
          {tr("Langkau — tambah pekerja kemudian")}</button>
      )}
    </MulaLayout>
  );
}
