"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { LANGKAH, getKemajuan } from "@/lib/onboarding";
import { urlSementara } from "@/lib/upload";
import { inisial, masaTeks, todayISO } from "@/lib/format";
import { IconCalendar, IconChat, IconCheck, IconReceipt } from "@/components/icons";
import { Screen } from "@/components/ui";

const BULAN = ["JAN", "FEB", "MAC", "APR", "MEI", "JUN", "JUL", "OGO", "SEP", "OKT", "NOV", "DIS"];

// Rujukan reka bentuk: design/OnboardingSelesai.dc.html
export default function OrientasiSelesaiPage() {
  const me = useMe();
  const emp = me.active!;
  const data = useData(async () => {
    const sb = getSupabase();
    const done = await getKemajuan(emp.id);
    const p = must(await sb.from("persons").select("photo_path").eq("id", me.personId).single());
    const e = must(await sb.from("employments").select("join_date, departments(head_person_id)").eq("id", emp.id).single());
    const cols = must(await sb.rpc("my_colleagues", { p_company: emp.companyId })) ?? [];
    return {
      done,
      photo: p.photo_path ? await urlSementara(p.photo_path) : null,
      joinDate: e.join_date,
      head: cols.find((c) => c.person_id === e.departments?.head_person_id)?.name ?? null,
    };
  }, [emp.id]);

  const d = data.data;
  const belum = d ? LANGKAH.filter((l) => l.href && !d.done.has(l.key)) : [];
  const lengkap = d && belum.length === 0;

  return (
    <Screen>
      <div className="flex flex-col items-center gap-3 bg-primary px-6 pt-12 pb-7 text-center text-white">
        <div className="relative">
          {d?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL bertandatangan sementara daripada storan peribadi
            <img src={d.photo} alt={`Gambar profil ${me.name}`} className="size-[88px] rounded-full border-[3px] border-white object-cover" />
          ) : (
            <span className="flex size-[88px] items-center justify-center rounded-full border-[3px] border-white bg-primary-soft text-2xl font-extrabold text-primary">
              {inisial(me.name)}
            </span>
          )}
          <span className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-white text-primary">
            <IconCheck size={16} />
          </span>
        </div>
        <h1 className="m-0 text-[26px] leading-[1.2] font-extrabold">
          {lengkap ? `Selamat datang ke pasukan, ${me.name}!` : `Hampir selesai, ${me.name}`}
        </h1>
        <span className="text-sm opacity-94">
          {lengkap
            ? `Akaun anda telah lengkap. HR${d?.head ? ` dan ${d.head}` : ""} akan dimaklumkan.`
            : `Masih ada ${belum.length} langkah: ${belum.map((l) => l.label.toLowerCase()).join(", ")}.`}
        </span>
      </div>

      <main className="flex grow flex-col gap-3.5 px-5 pt-[18px] pb-3.5">
        {!lengkap && d && (
          <Link
            href="/orientasi"
            className="flex h-12 items-center justify-center rounded-[14px] border-[1.5px] border-primary bg-surface text-[15px] font-bold"
          >
            Lengkapkan langkah yang tinggal
          </Link>
        )}

        {d && d.joinDate >= todayISO() && (
          <div className="flex items-center gap-3.5 rounded-card bg-surface px-4 py-3.5">
            <span className="flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
              <b className="text-xl leading-none font-extrabold">{Number(d.joinDate.slice(8, 10))}</b>
              <span className="text-[11px] font-bold">{BULAN[Number(d.joinDate.slice(5, 7)) - 1]}</span>
            </span>
            <div className="flex flex-col gap-[3px] text-sm">
              <span className="text-xs font-bold tracking-[0.04em] text-subtle">HARI PERTAMA</span>
              <b className="font-bold">
                {masaTeks(emp.workStart)}
                {d.head ? ` · lapor diri kepada ${d.head}` : ""}
              </b>
              <span className="text-muted">{emp.companyName}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[0.04em] text-subtle">ANDA KINI BOLEH</span>
          <div className="flex flex-col rounded-card bg-surface px-4 py-0.5">
            <Item href="/mohon/cuti" icon={<IconCalendar size={18} />}>
              Mohon cuti
            </Item>
            <Item href="/tuntutan/baru" icon={<IconReceipt size={18} />}>
              Buat tuntutan dengan gambar resit
            </Item>
            <Item href="/pembantu-ai" icon={<IconChat size={18} />} tone="bg-[#EDE9F8] text-ai">
              Tanya sebarang soalan melalui WhatsApp
            </Item>
          </div>
        </div>
      </main>

      <div className="px-5 pt-2.5 pb-7">
        <Link
          href="/utama"
          className="flex h-14 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white! hover:bg-primary-hover"
        >
          Masuk ke HRBoost
        </Link>
      </div>
    </Screen>
  );
}

function Item({ href, icon, tone = "bg-primary-soft text-primary", children }: { href: string; icon: ReactNode; tone?: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-[50px] items-center gap-3 border-t border-[#EEF2F1] text-[15px] font-semibold text-ink! first:border-t-0">
      <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] ${tone}`}>{icon}</span>
      {children}
    </Link>
  );
}
