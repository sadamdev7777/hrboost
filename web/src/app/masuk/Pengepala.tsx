import Link from "next/link";
import type { ReactNode } from "react";

/** Kerangka skrin log masuk (rujukan reka bentuk: design/Login.dc.html). */
export function KerangkaMasuk({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex flex-col gap-3 bg-primary px-6 pt-14 pb-8 text-on-primary">
        <span className="flex size-12 items-center justify-center rounded-logo bg-surface text-lg font-extrabold text-primary">HR</span>
        <h1 className="m-0 text-[26px] font-extrabold leading-[1.15]">
          Assalamualaikum.
          <br />
          Selamat datang.
        </h1>
        <span className="text-sm leading-normal opacity-[0.92]">
          Log masuk ke <b>HRBoost.io</b> — HR syarikat anda, terus melalui WhatsApp.
        </span>
      </header>
      {children}
      <div className="flex flex-col items-center gap-1.5 px-6 pb-8 text-center text-[13px] leading-normal text-muted">
        <span>Pekerja baharu? Semak WhatsApp anda untuk pautan jemputan daripada HR.</span>
        <Link href="/jemputan" className="font-bold">
          Saya mempunyai pautan jemputan
        </Link>
      </div>
    </main>
  );
}
