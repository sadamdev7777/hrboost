"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { useSaluran } from "@/lib/saluran";
import { useData } from "@/lib/useData";
import { PilihBahasaPekerja } from "@/components/PilihBahasaPekerja";
import { getJabatan, jemputPekerja, JENIS_PEKERJAAN, setBahasaPekerja, tambahPekerja, type BorangPekerja } from "@/lib/hr";
import { addDays, telefonPenuh, todayISO } from "@/lib/format";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";
import { HadPeranan, MedanBorang, Seksyen, inputKecil } from "@/components/Senarai";

// Rujukan reka bentuk: design/TambahPekerja.dc.html
export default function TambahPekerjaPage() {
  return (
    <HadPeranan roles={["hr", "admin"]} back="/pengurusan/pekerja">
      <Borang />
    </HadPeranan>
  );
}

function Borang() {
  const me = useMe();
  const emp = me.active!;
  const router = useRouter();
  const jab = useData(() => getJabatan(emp.companyId), [emp.companyId]);
  const [f, setF] = useState<BorangPekerja>({
    fullName: "",
    preferredName: "",
    phone: "",
    ic: "",
    departmentId: "",
    position: "",
    joinDate: addDays(todayISO(), 1),
    type: "permanent",
    probationMonths: 3,
    basic: "",
    language: "en",
  });
  const [jemput, setJemput] = useState(true);
  const saluran = useSaluran(emp.companyId);
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const set = <K extends keyof BorangPekerja>(k: K, v: BorangPekerja[K]) => setF({ ...f, [k]: v });
  // Jabatan mesti dipilih sendiri (elak tersilap masuk jabatan pertama mengikut abjad); satu jabatan sahaja = terus dipilih
  const deptId = f.departmentId || (jab.data?.length === 1 ? jab.data[0].id : "");
  const ketua = jab.data?.find((d) => d.id === deptId);

  async function simpan() {
    setRalat(null);
    const phone = telefonPenuh(f.phone);
    if (!f.fullName.trim()) return setRalat(tr("Sila isi nama penuh seperti dalam kad pengenalan."));
    if (!f.preferredName.trim()) return setRalat(tr("Sila isi nama panggilan."));
    if (!deptId && (jab.data?.length ?? 0) > 0) return setRalat(tr("Sila pilih jabatan."));
    if (!phone) return setRalat(tr("Nombor WhatsApp tidak sah."));
    if (!/^\d{6}-?\d{2}-?\d{4}$/.test(f.ic.trim())) return setRalat(tr("No. kad pengenalan tidak sah (contoh: 981128-14-5521)."));
    if (f.basic && !(Number(f.basic) >= 0)) return setRalat(tr("Gaji pokok tidak sah."));
    setBusy(true);
    try {
      const ic = f.ic.replace(/\D/g, "").replace(/^(\d{6})(\d{2})(\d{4})$/, "$1-$2-$3");
      const id = await tambahPekerja(emp.companyId, { ...f, phone, ic, departmentId: deptId });
      // Lalai pangkalan data ialah English; tetapkan hanya jika HR memilih Bahasa Melayu (sebelum jemputan dihantar)
      if (f.language === "ms") await setBahasaPekerja(id, "ms");
      if (jemput) {
        const tok = await jemputPekerja(id);
        try {
          sessionStorage.setItem(`hrb_pautan_jemputan:${id}`, `${window.location.origin}/jemputan/${tok}`);
        } catch {}
      }
      router.replace(`/pengurusan/pekerja/${id}${jemput ? tr("?jemput=1") : ""}`);
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackHeader
        title={tr("Tambah pekerja")}
        href="/pengurusan/pekerja"
        action={
          <Link href="/mula/import" className="p-3 text-sm font-bold">
            {tr("Import Excel")}</Link>
        }
      />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-4">
        <Seksyen>{tr("MAKLUMAT PERIBADI")}</Seksyen>
        <MedanBorang label={tr("Nama penuh (seperti dalam kad pengenalan)")}>
          <input className={inputKecil} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder={tr("Nama seperti dalam kad pengenalan")} />
        </MedanBorang>
        <MedanBorang label={tr("Nama panggilan")}>
          <input className={inputKecil} value={f.preferredName} onChange={(e) => set("preferredName", e.target.value)} placeholder={tr("Contoh: Nurin")} />
        </MedanBorang>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <MedanBorang label={tr("No. WhatsApp")}>
            <input className={inputKecil} type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder={tr("01x-xxx xxxx")} />
          </MedanBorang>
          <MedanBorang label={tr("No. kad pengenalan")}>
            <input className={inputKecil} value={f.ic} onChange={(e) => set("ic", e.target.value)} inputMode="numeric" placeholder="981128-14-5521" />
          </MedanBorang>
        </div>
        <MedanBorang label={tr("Bahasa")} nota={tr("Untuk WhatsApp, aplikasi dan Pembantu AI. Pekerja boleh menukarnya sendiri kemudian.")}>
          <PilihBahasaPekerja nilai={f.language ?? "en"} onChange={(v) => set("language", v)} />
        </MedanBorang>

        <Seksyen className="pt-1">{tr("PEKERJAAN DI {0}", emp.companyCode)}</Seksyen>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 [&_input]:min-w-0 [&_select]:min-w-0">
          <MedanBorang label={tr("Jabatan")}>
            <select className={inputKecil} value={deptId} onChange={(e) => set("departmentId", e.target.value)}>
              {!deptId && <option value="">{tr("Pilih jabatan")}</option>}
              {(jab.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </MedanBorang>
          <MedanBorang label={tr("Jawatan")}>
            <input className={inputKecil} value={f.position} onChange={(e) => set("position", e.target.value)} placeholder={tr("cth. Eksekutif Jualan")} />
          </MedanBorang>
          <MedanBorang label={tr("Tarikh mula")}>
            <input className={inputKecil} type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
          </MedanBorang>
          <MedanBorang label={tr("Jenis")}>
            <select className={inputKecil} value={f.type} onChange={(e) => set("type", e.target.value as BorangPekerja["type"])}>
              {JENIS_PEKERJAAN.map((j) => (
                <option key={j.value} value={j.value}>
                  {tr(j.label)}
                </option>
              ))}
            </select>
          </MedanBorang>
          <MedanBorang label={tr("Percubaan")}>
            <select className={inputKecil} value={f.probationMonths} onChange={(e) => set("probationMonths", Number(e.target.value))}>
              <option value={3}>{tr("3 bulan")}</option>
              <option value={6}>{tr("6 bulan")}</option>
              <option value={0}>{tr("Tiada")}</option>
            </select>
          </MedanBorang>
          <MedanBorang label={tr("Gaji pokok (RM)")}>
            <input className={inputKecil} inputMode="decimal" value={f.basic} onChange={(e) => set("basic", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
          </MedanBorang>
        </div>
        <div className="rounded-[14px] bg-surface px-4 py-3 text-[13px] text-[#4A5A57]">
          <b className="text-ink">{tr("Ketua: {0}", ketua?.headName ?? tr("Belum ditetapkan"))}</b> {" "}{tr("(ketua jabatan {0}) · boleh ditukar kemudian", ketua?.name ?? "-")}</div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={jemput} onChange={(e) => setJemput(e.target.checked)} className="size-5 accent-primary" />
          {saluran.whatsapp ? tr("Hantar jemputan WhatsApp sekarang") : tr("Sediakan pautan jemputan sekarang")}</label>
        {ralat && <ErrorBox message={ralat} />}
      </main>
      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-3 pb-5">
        <button type="button" onClick={simpan} disabled={busy} className="h-12 w-full rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? tr("Menyimpan…") : jemput ? tr("Simpan & jemput") : tr("Simpan")}
        </button>
      </div>
    </Screen>
  );
}
