"use client";

import { tr } from "@/lib/i18n";
import { SenaraiPermohonanSaya } from "@/components/PermohonanSaya";
import { BackHeader, Screen } from "@/components/ui";

// Rujukan reka bentuk: design/PermohonanSaya.dc.html
export default function PermohonanSayaPage() {
  return (
    <Screen>
      <BackHeader title={tr("Permohonan saya")} href="/utama" />
      <main className="flex grow flex-col gap-2.5 px-4 pt-1 pb-4">
        <SenaraiPermohonanSaya />
      </main>
    </Screen>
  );
}
