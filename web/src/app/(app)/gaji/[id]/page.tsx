"use client";

import { useParams } from "next/navigation";
import { useData } from "@/lib/useData";
import { getSlip } from "@/lib/gaji";
import { SlipGajiCetak } from "@/components/SlipGajiCetak";

// Rujukan reka bentuk: design/SlipGaji.dc.html (A4). "Simpan sebagai PDF" melalui dialog cetak pelayar.
export default function SlipGajiPage() {
  const { id } = useParams<{ id: string }>();
  const d = useData(() => getSlip(id), [id]);
  return <SlipGajiCetak d={d} back="/gaji" />;
}
