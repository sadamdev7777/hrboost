import { tr } from "@/lib/i18n";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Kandungan from "./Kandungan";

// Teks sumber dalam BM; tr() di pelayan memulangkan English (bahasa lalai)
const TAJUK = "HRBoost.io — Urusan HR yang lengkap, tanpa pegawai HR";
const HURAIAN =
  "Sistem HR percuma untuk syarikat 5–50 pekerja di Malaysia yang tiada pegawai HR. Cuti, tuntutan, kehadiran dan gaji (KWSP, PERKESO, PCB) dalam satu sistem; pekerja memohon melalui telefon dan ketua meluluskan dengan satu sentuhan.";

export async function generateMetadata(): Promise<Metadata> {
  const ms = (await cookies()).get("hrb_bahasa")?.value === "ms";
  const title = ms ? TAJUK : tr(TAJUK);
  const description = ms ? HURAIAN : tr(HURAIAN);
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "HRBoost.io", locale: ms ? "ms_MY" : "en_MY" },
    twitter: { card: "summary", title, description },
  };
}

// Kandungan dipaparkan di pelayar supaya mengikut bahasa pilihan pengguna (lib/i18n).
export default function Homepage() {
  return <Kandungan />;
}
