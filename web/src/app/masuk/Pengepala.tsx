import Link from "next/link";
import type { ReactNode } from "react";

const CIRI = ["Mohon cuti & tuntutan dari telefon", "Lulus terus dari WhatsApp", "Gaji, KWSP, PERKESO & PCB automatik"];

/**
 * Kerangka skrin log masuk (rujukan reka bentuk: design/Login.dc.html).
 * Telefon: pengepala hijau di atas borang. Desktop: panel jenama di kiri, borang di kanan.
 */
export function KerangkaMasuk({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full bg-page text-ink">
      <div className="hidden w-[46%] max-w-[640px] flex-col justify-between bg-primary px-14 py-12 text-on-primary lg:flex">
        <Link href="/" className="flex items-center gap-2.5 text-white!">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-surface text-base font-extrabold text-primary">HR</span>
          <b className="text-xl font-extrabold">HRBoost.io</b>
        </Link>
        <div className="flex flex-col gap-6">
          <h1 className="m-0 text-[40px] leading-[1.12] font-extrabold">
            Assalamualaikum.
            <br />
            Selamat datang.
          </h1>
          <p className="m-0 max-w-[420px] text-lg leading-relaxed opacity-90">HR syarikat anda, terus melalui WhatsApp.</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {CIRI.map((c) => (
              <li key={c} className="flex items-center gap-3 text-base font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/18 text-sm">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <span className="text-sm opacity-75">Sistem HR percuma untuk syarikat di Malaysia.</span>
      </div>

      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col lg:max-w-[440px] lg:justify-center">
        <header className="flex flex-col gap-3 bg-primary px-6 pt-14 pb-8 text-on-primary lg:bg-transparent lg:px-6 lg:pt-0 lg:pb-2 lg:text-ink">
          <span className="flex size-12 items-center justify-center rounded-logo bg-surface text-lg font-extrabold text-primary lg:hidden">HR</span>
          <h1 className="m-0 text-[26px] leading-[1.15] font-extrabold lg:hidden">
            Assalamualaikum.
            <br />
            Selamat datang.
          </h1>
          <span className="text-sm leading-normal opacity-[0.92] lg:hidden">
            Log masuk ke <b>HRBoost.io</b> — HR syarikat anda, terus melalui WhatsApp.
          </span>
          <h2 className="m-0 hidden text-2xl font-extrabold lg:block">Log masuk</h2>
        </header>
        {children}
        <div className="flex flex-col items-center gap-1.5 px-6 pb-8 text-center text-[13px] leading-normal text-muted">
          <span>Pekerja baharu? Semak WhatsApp anda untuk pautan jemputan daripada HR.</span>
          <Link href="/jemputan" className="font-bold">
            Saya mempunyai pautan jemputan
          </Link>
        </div>
      </main>
    </div>
  );
}
