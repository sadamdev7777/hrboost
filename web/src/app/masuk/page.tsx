import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Log masuk · HRBoost.io",
};

// Rujukan reka bentuk: design/Login.dc.html
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <header className="flex flex-col gap-[14px] bg-primary px-7 pt-[72px] pb-10 text-on-primary">
        <span className="flex size-12 items-center justify-center rounded-logo bg-surface text-lg font-extrabold text-primary">
          HR
        </span>
        <h1 className="m-0 text-[30px] font-extrabold leading-[1.15]">
          Assalamualaikum.
          <br />
          Selamat datang.
        </h1>
        <span className="text-sm leading-normal opacity-[0.92]">
          Log masuk ke <b>HRBoost.io</b> — HR syarikat anda, terus melalui WhatsApp.
        </span>
      </header>

      <LoginForm />

      <div className="flex flex-col items-center gap-1.5 px-6 pb-8 text-center text-[13px] leading-normal text-muted">
        <span>Pekerja baharu? Semak WhatsApp anda untuk pautan jemputan daripada HR.</span>
        <Link href="/jemputan" className="font-bold">
          Saya mempunyai pautan jemputan
        </Link>
      </div>
    </main>
  );
}
