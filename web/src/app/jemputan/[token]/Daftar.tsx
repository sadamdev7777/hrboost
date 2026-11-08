"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase";
import { useData } from "@/lib/useData";
import { bacaJemputan, padamJemputan, simpanJemputan } from "@/lib/invite";
import { digitTempatan, tarikh } from "@/lib/format";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { PHONE_KEY } from "../../masuk/LoginForm";

const noSubscribe = () => () => {};

type Preview = {
  ok: boolean;
  error?: string;
  accepted?: boolean;
  name?: string;
  phone?: string;
  company_code?: string;
  company_name?: string;
  position?: string | null;
  department?: string | null;
  head?: string | null;
  join_date?: string;
  status?: string;
  probation_months?: number | null;
  expires_at?: string;
  days_left?: number;
  attempts_left?: number;
};

// Rujukan reka bentuk: design/Daftar.dc.html
export function Daftar() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const preview = useData(async () => {
    const { data, error } = await getSupabase().rpc("invite_preview", { p_token: token });
    if (error) throw new Error(error.message);
    return data as unknown as Preview;
  }, [token]);

  const [ic4, setIc4] = useState("");
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorLocal, setError] = useState<string | null>(null);
  // Ralat daripada percubaan pengaktifan selepas OTP (lihat OtpForm)
  const errorOtp = useSyncExternalStore(noSubscribe, () => {
    const j = bacaJemputan();
    return j?.token === token ? (j.error ?? null) : null;
  }, () => null);
  const error = errorLocal ?? errorOtp;

  const p = preview.data;

  const aktifkan = useCallback(
    async (kod: string) => {
      setBusy(true);
      setError(null);
      const { data, error: err } = await getSupabase().rpc("accept_invite", { p_token: token, p_ic_last4: kod });
      setBusy(false);
      padamJemputan();
      if (err) {
        setError(err.message);
        return;
      }
      const r = data as unknown as { ok: boolean; error?: string; attempts_left?: number };
      if (!r.ok) {
        setError(r.attempts_left !== undefined ? `${r.error}. Baki cubaan: ${r.attempts_left}.` : (r.error ?? "Tidak berjaya."));
        preview.reload();
        return;
      }
      router.replace("/orientasi");
    },
    [token, router, preview],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p?.ok || !p.phone) return;
    padamJemputan(); // buang ralat percubaan lama
    if (!/^\d{4}$/.test(ic4)) {
      setError("Sila masukkan 4 digit terakhir no. kad pengenalan anda.");
      return;
    }
    if (!consent) {
      setError("Sila tandakan pengesahan notis privasi untuk meneruskan.");
      return;
    }
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session?.user.phone === p.phone) {
      await aktifkan(ic4);
      return;
    }
    // Sahkan nombor telefon yang dijemput dengan OTP dahulu.
    setBusy(true);
    if (data.session) await sb.auth.signOut();
    const { error: err } = await sb.auth.signInWithOtp({ phone: p.phone, options: { channel: "sms" } });
    setBusy(false);
    if (err) {
      setError("Kod pengesahan tidak dapat dihantar. Sila cuba lagi.");
      return;
    }
    simpanJemputan({ token, ic4 });
    try {
      sessionStorage.setItem(PHONE_KEY, p.phone);
    } catch {
      /* abaikan */
    }
    router.push("/masuk/kod");
  }

  if (preview.loading && !p) {
    return (
      <Screen lebar="sempit">
        <Loading />
      </Screen>
    );
  }

  if (!p?.ok) {
    return (
      <Screen lebar="sempit">
        <div className="flex grow flex-col justify-center gap-4 p-6">
          <h1 className="m-0 text-2xl font-extrabold">{p?.accepted ? "Akaun sudah aktif" : "Pautan tidak sah"}</h1>
          <p className="m-0 text-sm leading-normal text-subtle">{p?.error ?? preview.error}</p>
          <Link
            href="/masuk"
            className="flex h-12 items-center justify-center rounded-[14px] bg-primary text-sm font-bold text-white!"
          >
            Log masuk
          </Link>
        </div>
      </Screen>
    );
  }

  const syarikat = (p.company_name ?? "").replace(/\s+SDN\.?\s*BHD\.?$/i, "");
  const status =
    p.status === "probation" && p.probation_months ? `Percubaan ${p.probation_months} bulan` : p.status === "probation" ? "Percubaan" : "Tetap";
  const d = digitTempatan(p.phone ?? "");
  const telefon = `+60 ${d.slice(0, 2)}-•••• ${d.slice(-4)}`;
  const hariLagi = p.days_left ?? 7;

  return (
    <Screen lebar="sempit">
      <form onSubmit={submit} className="flex grow flex-col">
        <div className="flex grow flex-col gap-[18px] px-6 pt-12 pb-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold tracking-[0.04em] text-primary">JEMPUTAN DARIPADA HR</span>
            <h1 className="m-0 text-[22px] leading-[1.2] font-extrabold">
              Selamat datang ke {p.company_code}, {p.name}
            </h1>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Syarikat" value={syarikat} />
              <Info label="Jawatan" value={p.position ?? "—"} />
              <Info label="Jabatan" value={p.department ?? "—"} />
              <Info label="Ketua" value={p.head ?? "—"} />
              <Info label="Tarikh mula" value={p.join_date ? `${tarikh(p.join_date)} ${p.join_date.slice(0, 4)}` : "—"} />
              <Info label="Status" value={status} />
            </div>
            <span className="text-xs text-muted">Terdapat kesilapan? Maklumkan kepada HR sebelum meneruskan.</span>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Sahkan identiti: 4 digit terakhir no. kad pengenalan
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="••••"
              value={ic4}
              onChange={(e) => setIc4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-12 rounded-[14px] border-[1.5px] border-primary bg-surface px-4 text-base font-semibold tracking-[0.3em] text-ink"
            />
          </label>

          <label className="flex items-start gap-2.5 text-[13px] leading-normal text-[#33504B]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-px size-5 shrink-0 accent-primary"
            />
            <span>
              Saya faham bahawa maklumat peribadi saya disimpan untuk urusan HR dan gaji sahaja, mengikut{" "}
              <Link href="/privasi" className="font-bold">
                notis privasi
              </Link>{" "}
              syarikat.
            </span>
          </label>
          {error && <ErrorBox message={error} />}
        </div>

        <div className="flex flex-col gap-2 px-6 pt-3 pb-8">
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? "Memproses…" : "Aktifkan akaun"}
          </button>
          <span className="text-center text-xs text-muted">
            Pautan ini hanya sah untuk {telefon} dan akan tamat tempoh dalam {hariLagi} hari.
          </span>
        </div>
      </form>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <b className="text-sm font-bold">{value}</b>
    </div>
  );
}
