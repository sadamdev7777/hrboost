import type { Metadata } from "next";
import { OtpForm } from "./OtpForm";

export const metadata: Metadata = {
  title: "Kod OTP · HRBoost.io",
};

// Rujukan reka bentuk: design/OTP.dc.html
export default function OtpPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-page text-ink">
      <OtpForm />
    </main>
  );
}
