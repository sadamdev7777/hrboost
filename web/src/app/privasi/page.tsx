import { tr } from "@/lib/i18n";
import type { Metadata } from "next";
import Kandungan from "./Kandungan";

export const metadata: Metadata = {
  title: tr("Notis Privasi & Terma · HRBoost.io"),
};

// Kandungan dipaparkan di pelayar supaya mengikut bahasa pilihan pengguna (lib/i18n).
export default function PrivasiPage() {
  return <Kandungan />;
}
