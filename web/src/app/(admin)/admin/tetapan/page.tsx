"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { must, useData } from "@/lib/useData";
import { rpc } from "@/lib/admin";
import { ErrorBox, Loading } from "@/components/ui";
import { Suis } from "@/components/Senarai";

type Tetapan = Record<string, unknown>;

// Rujukan reka bentuk: design/SA_Tetapan.dc.html
export default function SaTetapan() {
  const d = useData(async () => {
    const rows = must(await getSupabase().from("platform_settings").select("key, value")) ?? [];
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Tetapan;
  }, []);
  const admins = useData(() => rpc<{ person_id: string; name: string; whatsapp: string | null }[]>("sa_platform_admins"), []);
  const [ralat, setRalat] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [baru, setBaru] = useState("");
  const t = d.data;

  async function set(key: string, value: unknown) {
    setRalat(null);
    setInfo(null);
    try {
      await rpc("sa_set_setting", { p_key: key, p_value: value });
      setInfo(tr("Disimpan."));
      d.reload();
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }
  const nombor = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));

  if (!t) return d.error ? <ErrorBox message={d.error} /> : <Loading />;
  const terbuka = t.registration_open !== false;
  const notis = typeof t.maintenance_notice === "string" ? t.maintenance_notice : "";

  return (
    <>
      <h1 className="m-0 text-2xl font-extrabold">{tr("Tetapan platform")}</h1>
      {info && <span className="rounded-[12px] bg-success-soft px-3 py-2 text-sm font-semibold text-success">{info}</span>}
      {ralat && <ErrorBox message={ralat} />}
      <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("PENDAFTARAN & HAD")}</span>
      <section className="flex max-w-[760px] flex-col rounded-card bg-surface px-5 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        <Baris t={tr("Pendaftaran syarikat baharu")} s={tr("Tutup buat sementara jika berlaku serangan spam")}>
          <Suis on={terbuka} label={terbuka ? tr("Tutup pendaftaran") : tr("Buka pendaftaran")} onChange={(v) => set("registration_open", v)} />
        </Baris>
        <Baris t={tr("Had WhatsApp lalai")} s={tr("Mesej sebulan bagi setiap syarikat (kosong = tiada had)")}>
          <Input aria={tr("Had WhatsApp lalai")} nilai={t.default_wa_limit} onSave={(v) => set("default_wa_limit", nombor(v))} />
        </Baris>
        <Baris t={tr("Had AI lalai")} s={tr("Bacaan resit, kad pengenalan & ringkasan sebulan")}>
          <Input aria={tr("Had AI lalai")} nilai={t.default_ai_limit} onSave={(v) => set("default_ai_limit", nombor(v))} />
        </Baris>
        <Baris t={tr("Amaran kepada Pentadbir syarikat")} s={tr("Apabila penggunaan mencapai (%)")}>
          <Input aria={tr("Peratus amaran")} nilai={t.warn_pct} onSave={(v) => set("warn_pct", nombor(v))} />
        </Baris>
      </section>
      <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("WHATSAPP PLATFORM")}</span>
      <section className="flex max-w-[760px] flex-col rounded-card bg-surface px-5 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        <Baris t={tr("Nombor HRBoost")} s={tr("Dihantar melalui Murpati · semua pemberitahuan lalai")}>
          <span className="rounded-lg bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">{tr("Menunggu konfigurasi Murpati")}</span>
        </Baris>
      </section>
      <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{tr("DATA & KESELAMATAN")}</span>
      <section className="flex max-w-[760px] flex-col rounded-card bg-surface px-5 text-sm [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
        <Baris t={tr("Simpan data syarikat yang dinyahaktifkan")} s={tr("Selepas tempoh ini, Pentadbir dimaklumkan dan data akan dipadam (hari)")}>
          <Input aria={tr("Tempoh simpanan")} nilai={t.retention_days} onSave={(v) => set("retention_days", nombor(v))} />
        </Baris>
        <div className="flex flex-col gap-2 py-3.5">
          <b>{tr("Pentadbir Platform")}</b>
          <span className="text-xs text-muted">{tr("Log masuk memerlukan OTP setiap kali.")}</span>
          {(admins.data ?? []).map((a) => (
            <span key={a.person_id}>
              {a.name} · <span className="text-muted">{a.whatsapp}</span>
            </span>
          ))}
          <div className="flex gap-2">
            <input value={baru} onChange={(e) => setBaru(e.target.value)} aria-label={tr("No. WhatsApp pengguna sedia ada")} placeholder={tr("No. WhatsApp pengguna sedia ada")} className="h-10 min-w-0 grow rounded-[10px] border border-line px-2.5" />
            <button
              type="button"
              disabled={!baru.trim()}
              onClick={async () => {
                setRalat(null);
                try {
                  await rpc("sa_add_platform_admin", { p_phone: baru });
                  setBaru("");
                  setInfo("Pentadbir Platform ditambah.");
                  admins.reload();
                } catch (e) {
                  setRalat(e instanceof Error ? e.message : "Ralat");
                }
              }}
              className="h-10 rounded-[10px] border border-primary px-3 font-bold text-primary disabled:opacity-50"
            >
              {tr("Tambah Pentadbir Platform")}</button>
          </div>
        </div>
        <div className="flex flex-col gap-2 py-3.5">
          <b>{tr("Mod penyelenggaraan")}</b>
          <span className="text-xs text-muted">{tr("Papar notis kepada semua pengguna (kosong = tiada notis).")}</span>
          <Input aria={tr("Notis penyelenggaraan")} nilai={notis} lebar onSave={(v) => set("maintenance_notice", v.trim() ? v.trim() : null)} />
        </div>
      </section>
    </>
  );
}

function Baris({ t, s, children }: { t: string; s: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 py-2">
      <span className="flex grow flex-col gap-0.5">
        <b>{t}</b>
        <span className="text-xs text-muted">{s}</span>
      </span>
      {children}
    </div>
  );
}

function Input({ aria, nilai, onSave, lebar }: { aria: string; nilai: unknown; onSave: (v: string) => void; lebar?: boolean }) {
  const awal = nilai === null || nilai === undefined ? "" : String(nilai);
  return (
    <input
      key={awal}
      aria-label={aria}
      defaultValue={awal}
      placeholder={lebar ? tr("Contoh: Penyelenggaraan dijadualkan 1:00–2:00 pagi") : tr("Tiada had")}
      onBlur={(e) => e.target.value !== awal && onSave(e.target.value)}
      className={`h-10 rounded-[10px] border border-line px-2.5 ${lebar ? "w-full" : "w-[120px] text-right"}`}
    />
  );
}
