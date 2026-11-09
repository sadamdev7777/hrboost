"use client";

import Link from "next/link";
import { useMe } from "@/lib/me";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { getBilanganTugasan } from "@/lib/data";
import { addDays, dow, hariPendek, masaRingkas, masaTeks, todayISO } from "@/lib/format";
import { Greeting } from "@/components/Greeting";
import { OrientasiBanner } from "@/components/OrientasiBanner";
import { Avatar, ErrorBox } from "@/components/ui";
import { TugasSemakKetua } from "@/components/SenaraiSemak";
import { KadPengumuman } from "@/components/Pengumuman";

type Ahli = {
  employmentId: string;
  personId: string;
  name: string;
  clockIn: string | null;
  late: boolean;
  lateCount: number;
  leaveToday: string | null; // "MC hari ini" / "Cuti hari ini"
};

type CutiHadapan = { name: string; label: string };

// Rujukan reka bentuk: design/KetuaUtama.dc.html
export function KetuaUtama() {
  const me = useMe();
  const emp = me.active!;
  const pending = useData(getBilanganTugasan, []);
  const team = useData(() => loadPasukan(me.headOfDepartmentIds, me.personId, emp.graceMinutes), [
    me.headOfDepartmentIds.join(),
  ]);

  const ahli = team.data?.ahli ?? [];
  const hadir = ahli.filter((a) => a.clockIn).length;
  const lewat = ahli.filter((a) => a.late).length;
  const cuti = ahli.filter((a) => a.leaveToday).length;
  const perhatian = ahli.filter((a) => a.late || a.leaveToday);
  const jabatan = (team.data?.deptName ?? emp.departmentName ?? "").toUpperCase();

  return (
    <main className="flex grow flex-col gap-3 px-4 pt-4 pb-4">
      <Greeting me={me} />
      <OrientasiBanner employmentId={emp.id} />
      <KadPengumuman companyId={emp.companyId} />

      <Link href="/kelulusan" className="flex items-center gap-3 rounded-[20px] bg-primary px-4 py-[18px] text-white!">
        <span className="flex grow flex-col gap-1">
          <span className="text-[13px] opacity-92">Menunggu kelulusan anda</span>
          <b className="text-[34px] leading-none font-extrabold">{pending.data ?? "–"}</b>
          <span className="text-[13px] opacity-92">Selesaikan sebelum {masaTeks(emp.workEnd)}</span>
        </span>
        <span className="flex h-11 items-center rounded-[14px] bg-white px-4 text-sm font-extrabold text-primary">Semak</span>
      </Link>

      <TugasSemakKetua companyId={emp.companyId} />

      {team.error && <ErrorBox message={team.error} />}

      <span className="text-xs font-bold tracking-[0.04em] text-subtle">PASUKAN {jabatan} HARI INI</span>
      <div className="grid grid-cols-3 gap-2">
        <Kotak n={hadir} label="Hadir" />
        <Kotak n={lewat} label="Lewat" warn />
        <Kotak n={cuti} label="MC / cuti" />
      </div>
      {perhatian.length > 0 && (
        <div className="flex flex-col rounded-card bg-surface px-4 py-1">
          {perhatian.map((a, i) => (
            <div key={a.employmentId} className={`flex min-h-[50px] items-center gap-3 text-sm ${i ? "border-t border-[#EEF2F1]" : ""}`}>
              <Avatar name={a.name} size={32} index={a.late ? 2 : 0} />
              <span className="grow font-bold">{a.name}</span>
              {a.late && a.clockIn ? (
                <span className="text-xs font-bold text-warning">
                  Masuk {masaRingkas(a.clockIn)} · kali ke-{a.lateCount}
                </span>
              ) : (
                <span className="text-xs text-muted">{a.leaveToday}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <span className="text-xs font-bold tracking-[0.04em] text-subtle">CUTI PASUKAN MINGGU HADAPAN</span>
      <div className="flex flex-col rounded-card bg-surface px-4 py-1">
        {(team.data?.hadapan ?? []).length === 0 ? (
          <div className="flex min-h-[50px] items-center text-sm text-muted">Tiada cuti dijadualkan.</div>
        ) : (
          team.data!.hadapan.map((c, i) => (
            <div key={i} className={`flex min-h-[50px] items-center gap-3 text-sm ${i ? "border-t border-[#EEF2F1]" : ""}`}>
              <Avatar name={c.name} size={32} />
              <span className="grow font-bold">{c.name}</span>
              <span className="text-xs text-muted">{c.label}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function Kotak({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-[14px] p-3 ${warn ? "bg-warning-soft" : "bg-surface"}`}>
      <b className={`text-xl font-extrabold ${warn ? "text-warning" : ""}`}>{n}</b>
      <span className={`text-xs ${warn ? "text-warning" : "text-muted"}`}>{label}</span>
    </div>
  );
}

async function loadPasukan(deptIds: string[], myPersonId: string, grace: number) {
  const sb = getSupabase();
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const nextMon = addDays(today, 7 - ((dow(today) + 6) % 7));
  const nextSun = addDays(nextMon, 6);

  const dept = must(await sb.from("departments").select("name").in("id", deptIds).limit(1));
  const emps = must(
    await sb
      .from("employments")
      .select("id, person_id, persons!employments_person_id_fkey(preferred_name, full_name)")
      .in("department_id", deptIds)
      .in("status", ["probation", "active"])
      .neq("person_id", myPersonId),
  );
  const ids = emps.map((e) => e.id);
  if (ids.length === 0) return { deptName: dept[0]?.name ?? null, ahli: [] as Ahli[], hadapan: [] as CutiHadapan[] };

  const [att, lateMonth, leaves] = await Promise.all([
    sb.from("attendance_records").select("employment_id, clock_in, late_minutes").in("employment_id", ids).eq("work_date", today),
    sb
      .from("attendance_records")
      .select("employment_id, late_minutes")
      .in("employment_id", ids)
      .gte("work_date", monthStart)
      .gt("late_minutes", grace),
    sb
      .from("leave_requests")
      .select("employment_id, start_date, end_date, status, cover_person_id, leave_types(code)")
      .in("employment_id", ids)
      .in("status", ["approved", "pending"])
      .lte("start_date", nextSun)
      .gte("end_date", today),
  ]);
  const attRows = must(att);
  const lateRows = must(lateMonth);
  const leaveRows = must(leaves);

  const nameOf = (empId: string) => {
    const e = emps.find((x) => x.id === empId);
    return e?.persons?.preferred_name || e?.persons?.full_name || "Pekerja";
  };
  const nameOfPerson = (pid: string | null) => {
    const e = emps.find((x) => x.person_id === pid);
    return e ? e.persons?.preferred_name || e.persons?.full_name : null;
  };

  const ahli: Ahli[] = emps.map((e) => {
    const a = attRows.find((x) => x.employment_id === e.id);
    const lv = leaveRows.find(
      (l) => l.employment_id === e.id && l.status === "approved" && l.start_date <= today && l.end_date >= today,
    );
    return {
      employmentId: e.id,
      personId: e.person_id,
      name: nameOf(e.id),
      clockIn: a?.clock_in ?? null,
      late: (a?.late_minutes ?? 0) > grace,
      lateCount: lateRows.filter((x) => x.employment_id === e.id).length,
      leaveToday: lv ? (lv.leave_types?.code === "MC" ? "MC hari ini" : "Cuti hari ini") : null,
    };
  });

  const hadapan: CutiHadapan[] = leaveRows
    .filter((l) => l.end_date >= nextMon && l.start_date <= nextSun)
    .map((l) => {
      const from = l.start_date < nextMon ? nextMon : l.start_date;
      const to = l.end_date > nextSun ? nextSun : l.end_date;
      const hari = from === to ? hariPendek(from) : `${hariPendek(from)}–${hariPendek(to)}`;
      const pic = nameOfPerson(l.cover_person_id);
      return {
        name: nameOf(l.employment_id),
        label: [hari, pic ? `Pengganti: ${pic}` : null, l.status === "pending" ? "menunggu" : null]
          .filter(Boolean)
          .join(" · "),
      };
    });

  return { deptName: dept[0]?.name ?? null, ahli, hadapan };
}
