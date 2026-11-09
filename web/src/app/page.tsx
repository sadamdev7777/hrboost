import { tr } from "@/lib/i18n";
import type { Metadata } from "next";
import Kandungan from "./Kandungan";

export const metadata: Metadata = {
  title: tr("HRBoost.io — Sistem HR percuma melalui WhatsApp"),
  description: tr("Pekerja memohon cuti dan membuat tuntutan melalui telefon. Ketua meluluskan dengan satu balasan. Gaji dikira mengikut KWSP, PERKESO dan PCB."),
};

// Kandungan dipaparkan di pelayar supaya mengikut bahasa pilihan pengguna (lib/i18n).
export default function Homepage() {
  return <Kandungan />;
}
