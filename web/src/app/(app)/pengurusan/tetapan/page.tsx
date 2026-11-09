"use client";

import { hasRole, useMe } from "@/lib/me";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { ButangBantuan, KadPanduan } from "@/components/Panduan";
import { BarisPautan, HadPeranan, Kotak, Seksyen } from "@/components/Senarai";

type Ringkasan = {
  workflows: number;
  delegations_active: number;
  automations: number;
  holidays: number;
  state: string;
  work_start: string;
  grace: number;
  accounting: string;
  code: string;
  kb_docs: number;
  attendance: boolean;
};

const AKAUN: Record<string, string> = { quickbooks: "QuickBooks", niagawan: "Niagawan", csv: "Eksport CSV", none: "Belum disambung" };
const NEGERI_RINGKAS: Record<string, string> = { "WP Kuala Lumpur": "WP KL", "WP Putrajaya": "WP Putrajaya", "WP Labuan": "WP Labuan" };

// Rujukan reka bentuk: design/Tetapan.dc.html
export default function TetapanPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]}>
      <Menu />
    </HadPeranan>
  );
}

const SEMUA_TETAPAN: { label: string; href: string; kata: string; roles?: ("hr" | "finance" | "ceo" | "admin")[] }[] = [
  { label: "Profil Syarikat", href: "/pengurusan/tetapan/syarikat", kata: "syarikat ssm alamat no majikan kwsp perkeso lhdn hrdf logo" },
  { label: "Waktu Kerja", href: "/pengurusan/tetapan/syarikat#waktu", kata: "waktu kerja masuk keluar lewat kelonggaran hujung minggu" },
  { label: "Jabatan & Ketua", href: "/pengurusan/tetapan/jabatan", kata: "jabatan ketua department", roles: ["hr", "admin"] },
  { label: "Pengguna & Peranan", href: "/pengurusan/tetapan/pengguna", kata: "pengguna peranan hr kewangan ceo pentadbir akses", roles: ["hr", "admin"] },
  { label: "Aliran Kelulusan", href: "/pengurusan/tetapan/aliran", kata: "aliran kelulusan peringkat pelulus ketua", roles: ["hr", "admin"] },
  { label: "Wakil Kelulusan", href: "/pengurusan/tetapan/wakil", kata: "wakil delegasi bercuti pelulus", roles: ["hr", "admin"] },
  { label: "Automasi WhatsApp", href: "/pengurusan/tetapan/automasi", kata: "automasi whatsapp mesej notifikasi peringatan", roles: ["hr", "admin"] },
  { label: "Jenis & Kelayakan Cuti", href: "/pengurusan/tetapan/cuti", kata: "cuti tahunan sakit mc kelayakan bawa ke hadapan", roles: ["hr", "admin"] },
  { label: "Cuti Umum", href: "/pengurusan/tetapan/cuti-umum", kata: "cuti umum public holiday negeri", roles: ["hr", "admin"] },
  { label: "Jenis Tuntutan & Had", href: "/pengurusan/tetapan/tuntutan", kata: "tuntutan claim had perbatuan makan resit", roles: ["hr", "finance", "admin"] },
  { label: "Kadar Berkanun", href: "/pengurusan/tetapan/kadar", kata: "kwsp perkeso sip eis pcb hrdf kadar caruman" },
  { label: "Integrasi Akaun", href: "/pengurusan/tetapan/akaun", kata: "quickbooks perakaunan akaun jurnal", roles: ["finance", "admin"] },
  { label: "Pengetahuan AI", href: "/pengurusan/tetapan/pengetahuan-ai", kata: "ai buku panduan polisi dokumen pembantu", roles: ["hr", "admin"] },
  { label: "Integrasi Kehadiran", href: "/pengurusan/tetapan/kehadiran", kata: "kehadiran crosschex mesin punch", roles: ["hr", "admin"] },
];

function Menu() {
  const me = useMe();
  const emp = me.active!;
  const r = useData(
    async () => must(await getSupabase().rpc("settings_summary", { p_company: emp.companyId })) as unknown as Ringkasan,
    [emp.companyId],
  );
  const jab = useData(
    async () => (await getSupabase().from("departments").select("id", { count: "exact", head: true }).eq("company_id", emp.companyId)).count ?? 0,
    [emp.companyId],
  );
  const x = r.data;
  const [cari, setCari] = useState("");
  const q = cari.trim().toLowerCase();
  const hasil = q ? SEMUA_TETAPAN.filter((t) => (!t.roles || hasRole(me, t.roles)) && (t.label.toLowerCase().includes(q) || t.kata.includes(q))) : [];
  const em = (t: string | number | undefined | null) => (t === undefined || t === null || t === "" ? undefined : <em className="text-[13px] font-semibold text-muted not-italic">{t}</em>);

  return (
    <Screen>
      <BackHeader
        title="Tetapan"
        href="/saya"
        action={<span className="mr-2 flex items-center gap-2"><ButangBantuan id="tetapan" /><span className="flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold text-primary">{emp.companyCode}</span></span>}
      />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        <KadPanduan id="tetapan" />
        {r.error && <ErrorBox message={r.error} />}
        <label className="flex h-12 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 lg:max-w-[420px]">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6B68" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Cari tetapan</span>
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari tetapan: cuti umum, KWSP, ketua…" className="h-full grow bg-transparent text-sm outline-none" />
        </label>
        {q && (
          <Kotak>
            {hasil.length === 0 && <span className="py-3 text-sm text-muted">Tiada tetapan sepadan dengan &ldquo;{cari}&rdquo;.</span>}
            {hasil.map((t) => (
              <BarisPautan key={t.href} href={t.href}>
                {t.label}
              </BarisPautan>
            ))}
          </Kotak>
        )}
<div className={`flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5 ${q ? "hidden!" : ""}`}>
<div className="flex flex-col gap-2.5">
        <Seksyen>SYARIKAT &amp; PEKERJA</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/syarikat" kanan={em(x?.code)}>
            Profil Syarikat
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/jabatan" roles={["hr","admin"]} kanan={em(jab.data && `${jab.data} jabatan`)}>
            Jabatan &amp; Ketua
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/pengguna" roles={["hr","admin"]}>Pengguna &amp; Peranan</BarisPautan>
        </Kotak>
</div>

<div className="flex flex-col gap-2.5">
        <Seksyen className="pt-1">KELULUSAN &amp; AUTOMASI</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/aliran" roles={["hr","admin"]} kanan={em(x && `${x.workflows} jenis`)}>
            Aliran Kelulusan
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/wakil" roles={["hr","admin"]} kanan={em(x && `${x.delegations_active} aktif`)}>
            Wakil Kelulusan
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/automasi" roles={["hr","admin"]} kanan={em(x && `${x.automations} peraturan`)}>
            Automasi WhatsApp
          </BarisPautan>
        </Kotak>
</div>

<div className="flex flex-col gap-2.5">
        <Seksyen className="pt-1">CUTI, TUNTUTAN &amp; KEHADIRAN</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/cuti" roles={["hr","admin"]}>Jenis &amp; Kelayakan Cuti</BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/cuti-umum" roles={["hr","admin"]} kanan={em(x && `${x.holidays} hari · ${NEGERI_RINGKAS[x.state] ?? x.state}`)}>
            Cuti Umum
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/tuntutan" roles={["hr","finance","admin"]}>Jenis Tuntutan &amp; Had</BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/syarikat#waktu" kanan={em(x && `${x.work_start} · ${x.grace} min`)}>
            Waktu Kerja
          </BarisPautan>
        </Kotak>
</div>

<div className="flex flex-col gap-2.5">
        <Seksyen className="pt-1">GAJI &amp; AKAUN</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/kadar" kanan={em("KWSP · PERKESO · PCB")}>
            Kadar Berkanun
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/akaun" roles={["finance","admin"]} kanan={em(x && AKAUN[x.accounting])}>
            Integrasi Akaun
          </BarisPautan>
        </Kotak>
</div>

<div className="flex flex-col gap-2.5">
        <Seksyen className="pt-1">SISTEM</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/pengetahuan-ai" roles={["hr","admin"]} kanan={em(x && (x.kb_docs ? `${x.kb_docs} dokumen` : "Buku panduan, polisi"))}>
            Pengetahuan AI
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/kehadiran" roles={["hr","admin"]} kanan={em(x && (x.attendance ? "CrossChex" : "Belum disambung"))}>
            Integrasi Kehadiran
          </BarisPautan>
        </Kotak>
</div>
</div>
      </main>
    </Screen>
  );
}
