"use client";

import Link from "next/link";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getDashboard, type Dashboard } from "@/lib/hr";
import { inisial, ringgit } from "@/lib/format";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan, Kotak, Seksyen, Tag } from "@/components/Senarai";

const AV = ["bg-[#FDEBD7] text-warning", "bg-[#E3F1EE] text-primary", "bg-[#EDE9F8] text-ai"];
const TAG: Record<Dashboard["attention"][number]["kind"], { label: string; tone: "danger" | "warning" | "ai" | "primary"; aksi: string }> = {
  sla: { label: "Tempoh", tone: "danger", aksi: "Lihat" },
  probation: { label: "Percubaan", tone: "warning", aksi: "Sahkan" },
  bank: { label: "Bank", tone: "primary", aksi: "Semak" },
  late: { label: "AI", tone: "ai", aksi: "Profil" },
};

// Rujukan reka bentuk: design/DashboardHR.dc.html
export default function DashboardHRPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]}>
      <Kandungan />
    </HadPeranan>
  );
}

function Kandungan() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getDashboard(emp.companyId), [emp.companyId]);
  const x = d.data;

  return (
    <Screen>
      <BackHeader
        title="Hari Ini"
        href="/saya"
        action={
          <span className="mr-2 flex h-9 items-center gap-1.5 rounded-full bg-[#E3F1EE] px-3 text-[13px] font-extrabold text-primary">{emp.companyCode}</span>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !x && <Loading />}
        {x && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Angka n={x.on_leave.length} label="Cuti / MC hari ini" />
              <Angka n={x.late_today} label="Lewat masuk" tone="warning" />
              <Angka n={x.sla_breached} label="Melepasi tempoh" tone="danger" />
            </div>

            <Seksyen>PERLU PERHATIAN</Seksyen>
            <Kotak>
              {x.attention.length === 0 && <span className="py-3 text-sm text-muted">Tiada perkara yang perlu perhatian.</span>}
              {x.attention.map((a, i) => (
                <div key={i} className="flex min-h-[50px] items-center gap-3 py-2 text-sm">
                  <Tag tone={TAG[a.kind].tone}>{TAG[a.kind].label}</Tag>
                  <span className="grow">{a.text}</span>
                  <Link
                    href={a.request_id ? `/permohonan/${a.request_id}` : `/pengurusan/pekerja/${a.employment_id}`}
                    className="text-[13px] font-bold"
                  >
                    {TAG[a.kind].aksi}
                  </Link>
                </div>
              ))}
            </Kotak>

            <Seksyen>SIAPA BERCUTI HARI INI</Seksyen>
            <Kotak>
              {x.on_leave.length === 0 && <span className="py-3 text-sm text-muted">Semua pekerja bertugas hari ini.</span>}
              {x.on_leave.map((c, i) => (
                <Link key={c.employment_id + i} href={`/pengurusan/pekerja/${c.employment_id}`} className="flex min-h-[50px] items-center gap-3 py-2 text-sm text-ink!">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${AV[i % 3]}`}>{inisial(c.name)}</span>
                  <span className="grow font-bold">{c.name}</span>
                  <span className="text-xs text-muted">
                    {[c.half_day !== "full" ? "Separuh hari" : c.leave === "MC" ? "MC" : c.leave === "AL" ? "Tahunan" : c.leave_name, c.department].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              ))}
            </Kotak>

            <Seksyen>BULAN INI</Seksyen>
            <div className="grid grid-cols-2 gap-2">
              <Angka n={ringgit(x.claims_approved_month)} label="Tuntutan diluluskan" kecil />
              <Angka n={x.payroll_draft == null ? "Belum dikira" : ringgit(x.payroll_draft)} label="Kos gaji (draf)" kecil />
            </div>

            <Link href="/pengurusan/akses" className="flex items-center gap-2 py-1 text-[13px] font-bold">
              Anda hanya boleh melihat {x.company_code}. Perlukan syarikat lain? Mohon akses
            </Link>
          </>
        )}
      </main>
    </Screen>
  );
}

function Angka({ n, label, tone, kecil }: { n: number | string; label: string; tone?: "warning" | "danger"; kecil?: boolean }) {
  const bg = tone === "warning" ? "bg-warning-soft text-warning" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface";
  return (
    <div className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 ${bg}`}>
      <b className={`${kecil ? "text-lg" : "text-xl"} font-extrabold`}>{n}</b>
      <span className={`text-xs ${tone ? "" : "text-muted"}`}>{label}</span>
    </div>
  );
}
