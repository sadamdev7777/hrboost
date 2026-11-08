"use client";

import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
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

function Menu() {
  const me = useMe();
  const emp = me.active!;
  const r = useData(
    async () => must(await getSupabase().rpc("settings_summary", { p_company: emp.companyId })) as unknown as Ringkasan,
    [emp.companyId],
  );
  const x = r.data;
  const em = (t: string | number | undefined | null) => (t === undefined || t === null || t === "" ? undefined : <em className="text-[13px] font-semibold text-muted not-italic">{t}</em>);

  return (
    <Screen>
      <BackHeader
        title="Tetapan"
        href="/saya"
        action={<span className="mr-2 flex h-9 items-center rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold text-primary">{emp.companyCode}</span>}
      />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-6">
        {r.error && <ErrorBox message={r.error} />}
        <Seksyen>KELULUSAN &amp; AUTOMASI</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/aliran" kanan={em(x && `${x.workflows} jenis`)}>
            Aliran Kelulusan
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/wakil" kanan={em(x && `${x.delegations_active} aktif`)}>
            Wakil Kelulusan
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/automasi" kanan={em(x && `${x.automations} peraturan`)}>
            Automasi WhatsApp
          </BarisPautan>
        </Kotak>

        <Seksyen className="pt-1">CUTI, TUNTUTAN &amp; KEHADIRAN</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/cuti">Jenis &amp; Kelayakan Cuti</BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/cuti-umum" kanan={em(x && `${x.holidays} hari · ${NEGERI_RINGKAS[x.state] ?? x.state}`)}>
            Cuti Umum
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/tuntutan">Jenis Tuntutan &amp; Had</BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/syarikat#waktu" kanan={em(x && `${x.work_start} · ${x.grace} min`)}>
            Waktu Kerja
          </BarisPautan>
        </Kotak>

        <Seksyen className="pt-1">GAJI &amp; AKAUN</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/kadar" kanan={em("KWSP · PERKESO · PCB")}>
            Kadar Berkanun
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/akaun" kanan={em(x && AKAUN[x.accounting])}>
            Integrasi Akaun
          </BarisPautan>
        </Kotak>

        <Seksyen className="pt-1">SISTEM</Seksyen>
        <Kotak>
          <BarisPautan href="/pengurusan/tetapan/syarikat" kanan={em(x?.code)}>
            Profil Syarikat
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/pengguna">Pengguna &amp; Peranan</BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/pengetahuan-ai" kanan={em(x && (x.kb_docs ? `${x.kb_docs} dokumen` : "Buku panduan, polisi"))}>
            Pengetahuan AI
          </BarisPautan>
          <BarisPautan href="/pengurusan/tetapan/kehadiran" kanan={em(x && (x.attendance ? "CrossChex" : "Belum disambung"))}>
            Integrasi Kehadiran
          </BarisPautan>
        </Kotak>
      </main>
    </Screen>
  );
}
