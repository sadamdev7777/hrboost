import { tr } from "@/lib/i18n";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { HosDialog, HosToast } from "@/components/Dialog";
import { BahasaAwal, LangHtml } from "@/components/PilihBahasa";
import { PelaporRalat } from "@/components/PelaporRalat";
import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HRBoost.io",
  description: tr("Sistem HR percuma untuk syarikat di Malaysia, terus melalui WhatsApp."),
};

export const viewport: Viewport = {
  themeColor: "#0F6B5F",
};

/** Bahasa permintaan (kuki hrb_bahasa) supaya HTML pelayan sama dengan paparan pelayar. */
async function DenganBahasa({ children }: { children: ReactNode }) {
  const b = (await cookies()).get("hrb_bahasa")?.value === "ms" ? "ms" : "en";
  return <BahasaAwal b={b}>{children}</BahasaAwal>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <DenganBahasa>{children}</DenganBahasa>
        </Suspense>
        <HosDialog />
        <HosToast />
        <LangHtml />
        <PelaporRalat />
      </body>
    </html>
  );
}
