import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { HosDialog, HosToast } from "@/components/Dialog";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "HRBoost.io",
  description: "Sistem HR percuma untuk syarikat di Malaysia, terus melalui WhatsApp.",
};

export const viewport: Viewport = {
  themeColor: "#0F6B5F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ms" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <HosDialog />
        <HosToast />
      </body>
    </html>
  );
}
