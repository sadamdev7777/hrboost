"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { LANGKAH, getKemajuan, langkahSeterusnya } from "@/lib/onboarding";
import { masaTeks, todayISO } from "@/lib/format";
import { IconCheck } from "@/components/icons";
import { Loading, Screen } from "@/components/ui";

const BULAN = ["JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGO", "SEP", "OKT", "NOV", "DIS"];

// Rujukan reka bentuk: design/Onboarding.dc.html
export default function OrientasiPage() {
  const me = useMe();
  const emp = me.active!;
  const done = useData(() => getKemajuan(emp.id), [emp.id]);
  const hariPertama = useData(() => loadHariPertama(emp.id, emp.companyId), [emp.id]);

  if (!done.data) {
    return (
      <Screen lebar="sederhana">
        <Loading />
      </Screen>
    );
  }
  const n = LANGKAH.filter((l) => done.data!.has(l.key)).length;
  const pct = Math.round((n / LANGKAH.length) * 100);
  const seterusnya = langkahSeterusnya(done.data);
  const nextKey = LANGKAH.find((l) => l.href === seterusnya)?.key;
  const hp = hariPertama.data;

  return (
    <Screen lebar="sederhana">
      <main className="flex grow flex-col gap-3 px-4 pt-7 pb-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-2xl font-extrabold">{tr("Lengkapkan akaun anda")}</h1>
          <span className="text-sm text-subtle">{tr("Lebih kurang 10 minit. Boleh disambung kemudian.")}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] font-bold">
            <span>
              {tr("{0} daripada {1} selesai", n, LANGKAH.length)}</span>
            <span className="text-primary">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-[#DCE3E1]" aria-hidden="true">
            <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex flex-col rounded-card bg-surface px-4 py-1">
          {LANGKAH.map((l, i) => {
            const ok = done.data!.has(l.key);
            const now = l.key === nextKey;
            const inner = (
              <>
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${
                    ok ? "bg-primary text-white" : now ? "border-[3px] border-primary bg-surface" : "border-2 border-line-strong"
                  }`}
                >
                  {ok && <IconCheck size={14} />}
                </span>
                <span className={ok ? "text-muted line-through" : ""}>{tr(l.label)}</span>
                {!ok && (
                  <span className={`ml-auto text-xs whitespace-nowrap ${now ? "font-bold text-primary" : "text-muted"}`}>
                    {now ? tr("Mulakan →") : l.masa}
                  </span>
                )}
              </>
            );
            const cls = `flex min-h-[46px] items-center gap-3 text-sm text-ink! ${i ? "border-t border-[#EEF2F1]" : ""} ${
              now ? "-mx-4 bg-[#F2F8F7] px-4 font-extrabold" : ""
            }`;
            return l.href ? (
              <Link key={l.key} href={l.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={l.key} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>

        {hp && hp.joinDate >= todayISO() && (
          <div className="flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3">
            <span className="text-xs font-bold tracking-[0.04em] text-subtle">{tr("HARI PERTAMA ANDA")}</span>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-[52px] shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
                <b className="text-lg leading-none font-extrabold">{Number(hp.joinDate.slice(8, 10))}</b>
                <span className="text-[11px] font-bold">{BULAN[Number(hp.joinDate.slice(5, 7)) - 1]}</span>
              </span>
              <div className="flex flex-col gap-0.5 text-sm">
                <b className="font-bold">
                  {masaTeks(emp.workStart)}
                  {hp.head ? tr(" · lapor diri kepada {0}", hp.head) : ""}
                </b>
                <span className="text-muted">{emp.companyName}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="bar-bawah sticky bottom-0 flex flex-col gap-1.5 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <Link
          href={seterusnya}
          className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white! hover:bg-primary-hover"
        >
          {n === LANGKAH.length ? tr("Lihat ringkasan") : tr("Teruskan")}
        </Link>
        <Link href="/utama" className="flex h-10 items-center justify-center text-sm font-bold">
          {tr("Lakukan kemudian")}</Link>
      </div>
    </Screen>
  );
}

async function loadHariPertama(employmentId: string, companyId: string) {
  const sb = getSupabase();
  const e = must(await sb.from("employments").select("join_date, departments(head_person_id)").eq("id", employmentId).single());
  let head: string | null = null;
  const headId = e.departments?.head_person_id;
  if (headId) {
    const cols = must(await sb.rpc("my_colleagues", { p_company: companyId })) ?? [];
    head = cols.find((c) => c.person_id === headId)?.name ?? null;
  }
  return { joinDate: e.join_date, head };
}
