"use client";

import { tr } from "@/lib/i18n";
import { beritahu } from "@/components/Dialog";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useMe, useMeContext } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getProfil, mohonTukarBank, simpanProfil, sorokAkaun, sorokIC, type Profil } from "@/lib/profil";
import { muatNaikPeribadi } from "@/lib/upload";
import { BANK, HUBUNGAN } from "@/lib/senarai";
import { inisial } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

// Rujukan reka bentuk: design/ProfilUbah.dc.html
export default function ProfilUbahPage() {
  const me = useMe();
  const p = useData(() => getProfil(me.personId), [me.personId]);
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Ubah profil")} href="/profil" />
      {p.error && <ErrorBox message={p.error} />}
      {p.loading && !p.data && <Loading />}
      {p.data && <Borang profil={p.data} />}
    </Screen>
  );
}

const inputCls =
  "h-10 min-w-0 grow rounded-[10px] border border-[#D5DEDC] bg-surface px-2.5 text-sm font-semibold text-ink outline-none focus:border-primary";

function Borang({ profil }: { profil: Profil }) {
  const me = useMe();
  const ctx = useMeContext();
  const router = useRouter();
  const fail = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    preferred_name: profil.preferredName,
    address: profil.address ?? "",
    children_count: String(profil.childrenCount),
    hide_birthday: profil.hideBirthday,
    contact_name: profil.waris?.name ?? "",
    contact_relationship: profil.waris?.relationship ?? "",
    contact_phone: profil.waris?.phone ?? "",
  });
  const [bank, setBank] = useState("");
  const [akaun, setAkaun] = useState("");
  const [foto, setFoto] = useState<"idle" | "upload" | "ok">("idle");
  const [busy, setBusy] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function gantiFoto(file: File | undefined) {
    if (!file) return;
    setRalat(null);
    setFoto("upload");
    try {
      const path = await muatNaikPeribadi(me.personId, "swafoto", file);
      must(await getSupabase().rpc("update_my_profile", { p_data: { photo_path: path }, p_via: "web" }));
      setFoto("ok");
    } catch (e) {
      setFoto("idle");
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
    }
  }

  async function simpan() {
    setRalat(null);
    if (!/^\d{1,2}$/.test(f.children_count.trim())) return setRalat(tr("Bilangan anak tidak sah."));
    if ((akaun.trim() && !bank) || (bank && !akaun.trim())) return setRalat(tr("Sila pilih bank dan isi nombor akaun baharu."));
    setBusy(true);
    try {
      await simpanProfil({ ...f, children_count: f.children_count.trim() });
      if (bank && akaun.trim()) await mohonTukarBank(bank, akaun);
      ctx.reload();
      beritahu(tr("Profil dikemas kini."));
      router.replace("/profil");
    } catch (e) {
      setRalat(e instanceof Error ? e.message : tr("Ralat"));
      setBusy(false);
    }
  }

  return (
    <>
      <main className="flex grow flex-col gap-2.5 px-4 pt-0.5 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-white">{inisial(f.preferred_name || profil.fullName)}</span>
          <button type="button" onClick={() => fail.current?.click()} disabled={foto === "upload"} className="py-3 text-sm font-bold text-primary">
            {foto === "upload" ? tr("Memuat naik…") : foto === "ok" ? tr("Swafoto dikemas kini") : tr("Ambil swafoto baharu")}
          </button>
          <input ref={fail} type="file" accept="image/*" capture="user" className="hidden" aria-label={tr("Ambil swafoto baharu")} onChange={(e) => gantiFoto(e.target.files?.[0])} />
        </div>

        <Seksyen>{tr("BOLEH DIUBAH SENDIRI")}</Seksyen>
        <Kotak>
          <Baris label={tr("Nama panggilan")}>
            <input className={inputCls} value={f.preferred_name} onChange={set("preferred_name")} maxLength={40} />
          </Baris>
          <Baris label={tr("Alamat")}>
            <input className={inputCls} value={f.address} onChange={set("address")} placeholder={tr("Alamat semasa")} />
          </Baris>
          <Baris label={tr("Waris")}>
            <input className={inputCls} value={f.contact_name} onChange={set("contact_name")} placeholder={tr("Nama waris")} />
          </Baris>
          <Baris label={tr("Hubungan")}>
            <select className={inputCls} value={f.contact_relationship} onChange={set("contact_relationship")}>
              <option value="">{tr("Pilih")}</option>
              {HUBUNGAN.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Baris>
          <Baris label={tr("Telefon waris")}>
            <input className={inputCls} value={f.contact_phone} onChange={set("contact_phone")} inputMode="tel" placeholder={tr("01x-xxx xxxx")} />
          </Baris>
          <Baris label={tr("Anak (PCB)")}>
            <input className={inputCls} value={f.children_count} onChange={set("children_count")} inputMode="numeric" />
          </Baris>
          <div className="flex min-h-12 items-center gap-2.5 text-sm">
            <span className="grow text-muted">{tr("Sembunyikan hari jadi")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={f.hide_birthday}
              aria-label={f.hide_birthday ? tr("Paparkan hari jadi") : tr("Sembunyikan hari jadi")}
              onClick={() => setF({ ...f, hide_birthday: !f.hide_birthday })}
              className="flex h-11 w-[52px] items-center justify-end"
            >
              <span className={`relative block h-7 w-[46px] rounded-full ${f.hide_birthday ? "bg-primary" : "bg-[#C9D3D1]"}`}>
                <span className={`absolute top-[3px] size-[22px] rounded-full bg-white ${f.hide_birthday ? "right-[3px]" : "left-[3px]"}`} />
              </span>
            </button>
          </div>
        </Kotak>

        <Seksyen>{tr("PERLU DISAHKAN HR")}</Seksyen>
        <Kotak>
          <Baris label={tr("Bank")}>
            <select className={inputCls} value={bank} onChange={(e) => setBank(e.target.value)} aria-label={tr("Bank baharu")}>
              <option value="">{profil.bankName ? tr("{0} (semasa)", profil.bankName) : tr("Pilih bank")}</option>
              {BANK.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Baris>
          <Baris label={tr("Akaun bank")}>
            <input className={inputCls} value={akaun} onChange={(e) => setAkaun(e.target.value)} inputMode="numeric" placeholder={sorokAkaun(profil.bankAccountNo)} aria-label={tr("No. akaun baharu")} />
          </Baris>
        </Kotak>
        {profil.bankMenunggu && <span className="text-xs text-warning">{tr("Satu pertukaran sedang menunggu HR. Permohonan baharu akan menggantikannya.")}</span>}

        <Seksyen>{tr("HANYA HR BOLEH MENGUBAH")}</Seksyen>
        <Kotak>
          <Baris label={tr("Nama penuh")}>
            <span className="grow font-bold">{profil.fullName}</span>
          </Baris>
          <Baris label={tr("No. kad pengenalan")}>
            <span className="grow font-bold">{sorokIC(profil.icNo)}</span>
          </Baris>
        </Kotak>
        {ralat && <ErrorBox message={ralat} />}
      </main>

      <div className="bar-bawah sticky bottom-0 border-t border-line-soft bg-surface px-4 pt-2.5 pb-[26px]">
        <button type="button" onClick={simpan} disabled={busy} className="h-12 w-full rounded-button bg-primary text-base font-extrabold text-white disabled:opacity-60">
          {busy ? tr("Menyimpan…") : tr("Simpan")}
        </button>
      </div>
    </>
  );
}

function Seksyen({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.04em] text-[#4A5A57]">{children}</span>;
}

function Kotak({ children }: { children: ReactNode }) {
  return <div className="flex flex-col rounded-card bg-surface px-4 py-0.5 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">{children}</div>;
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-2.5 text-sm">
      <span className="w-[110px] shrink-0 text-muted lg:w-[170px]">{label}</span>
      {children}
    </label>
  );
}
