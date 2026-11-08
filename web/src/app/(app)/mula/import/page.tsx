"use client";

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
      setRalat(e instanceof Error ? e.message : "Fail tidak dapat dibaca.");
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
      setRalat(e instanceof Error ? e.message : "Ralat");
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
      title="Import pekerja"
      back="/mula/syarikat"
      footer={
        rows?.length ? (
          <div className="flex flex-col gap-2">
            <ButangUtama onClick={importkan} busy={busy}>
              Import {rows.length} pekerja
            </ButangUtama>
            <span className="text-center text-xs text-muted">Ketua yang tiada akan ditetapkan pada langkah seterusnya. Jemputan belum dihantar.</span>
          </div>
        ) : undefined
      }
    >
      <button type="button" onClick={() => fail.current?.click()} className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-[#C9D3D1] bg-surface px-4 py-4">
        <b className="text-[15px] font-extrabold">Muat naik Excel sedia ada</b>
        <span className="text-[13px] text-muted">{namaFail ? `${namaFail} ✓` : ".xlsx atau .csv"}</span>
      </button>
      <input ref={fail} type="file" className="hidden" aria-label="Pilih fail Excel pekerja" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => baca(e.target.files?.[0])} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={templat} className="h-11 rounded-[12px] border border-line bg-surface text-sm font-bold">
          Muat turun templat
        </button>
        <Link href="/pengurusan/pekerja/baru" className="flex h-11 items-center justify-center rounded-[12px] border border-line bg-surface text-sm font-bold text-ink!">
          Tambah seorang demi seorang
        </Link>
      </div>
      {ralat && <ErrorBox message={ralat} />}
      {gagal.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[14px] bg-danger-soft px-4 py-3 text-[13px] text-danger">
          <b>{gagal.length} baris tidak diimport:</b>
          {gagal.map((g) => (
            <span key={g.row}>
              {g.name || `Baris ${g.row}`}: {g.error}
            </span>
          ))}
          <button type="button" onClick={() => router.push("/mula/jabatan")} className="mt-1 self-start font-bold underline">
            Teruskan tanpa baris ini
          </button>
        </div>
      )}
      {rows && (
        <>
          <div className="rounded-[14px] bg-[#F3F0FC] px-4 py-3 text-[13px] leading-normal text-[#4A3B8C]">
            <b>Sistem menemui {rows.length} pekerja.</b> Lajur dipadankan secara automatik walaupun format Excel anda berbeza. {perluSemak.length ? `${perluSemak.length} rekod perlu disemak.` : "Semua rekod lengkap."}
          </div>
          <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {papar.map((r, i) => (
              <div key={i} className="flex min-h-[54px] items-center gap-2 py-2">
                <span className="flex grow flex-col gap-0.5">
                  <b className="text-sm font-bold">{r.full_name}</b>
                  <span className="text-xs text-muted">
                    {[r.department || "Tiada jabatan", r.is_head ? "Ketua Jabatan" : r.head_name ? `ketua: ${r.head_name}` : "ketua: —"].join(" · ")}
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
              {semua ? "Ringkaskan" : `Lihat semua ${rows.length}`}
            </button>
          )}
        </>
      )}
      {!rows && (
        <button type="button" onClick={langkau} className="self-start py-2 text-sm font-bold text-muted underline">
          Langkau — tambah pekerja kemudian
        </button>
      )}
    </MulaLayout>
  );
}
