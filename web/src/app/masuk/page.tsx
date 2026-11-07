import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Log masuk · HRBoost.io",
};

// Rujukan reka bentuk: design/Login.dc.html
// Fasa A: halaman paparan sahaja. Hantar OTP melalui WhatsApp dilaksanakan dalam Fasa B.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex flex-col gap-[14px] bg-primary px-7 pt-[72px] pb-10 text-on-primary">
        <span className="flex size-14 items-center justify-center rounded-logo bg-surface text-lg font-extrabold text-primary">
          HR
        </span>
        <h1 className="m-0 text-[30px] font-extrabold leading-[1.15]">
          Assalamualaikum.
          <br />
          Selamat datang.
        </h1>
        <span className="text-[15px] leading-normal opacity-[0.92]">
          Log masuk ke <b>HRBoost.io</b> — HR syarikat anda, terus melalui WhatsApp.
        </span>
      </header>

      <div className="flex grow flex-col gap-4 px-6 pt-8 pb-4">
        <label className="flex flex-col gap-2 text-[15px] leading-[normal] font-bold">
          No. telefon WhatsApp
          <div className="flex gap-2">
            <span className="box-content flex h-14 items-center rounded-field border border-line bg-surface px-[14px] text-base font-bold">
              +60
            </span>
            <input
              type="tel"
              name="phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="12 345 6789"
              className="h-14 min-w-0 grow rounded-field border-[1.5px] border-primary bg-surface px-4 text-lg font-semibold tracking-[0.02em] text-ink outline-none"
            />
          </div>
        </label>
        <span className="text-[13px] leading-normal text-muted">
          Kami akan menghantar kod 6 digit ke WhatsApp anda. Tiada kata laluan yang perlu diingati.
        </span>

        <Link
          href="/masuk/kod"
          className="mt-2 flex h-14 items-center justify-center rounded-button bg-primary text-base font-extrabold text-on-primary! hover:bg-primary-hover"
        >
          Hantar kod
        </Link>
        <Link
          href="/masuk/emel"
          className="flex h-touch items-center justify-center text-sm font-bold"
        >
          Gunakan e-mel sebagai alternatif
        </Link>
      </div>

      <div className="flex flex-col items-center gap-1.5 px-6 pb-8 text-center text-[13px] leading-normal text-muted">
        <span>Pekerja baharu? Semak WhatsApp anda untuk pautan jemputan daripada HR.</span>
        <Link href="/jemputan" className="font-bold">
          Saya mempunyai pautan jemputan
        </Link>
      </div>
    </main>
  );
}
