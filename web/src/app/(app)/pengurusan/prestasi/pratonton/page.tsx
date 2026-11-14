"use client";

import { tr } from "@/lib/i18n";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getKitaran } from "@/lib/prestasi";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { HadPeranan } from "@/components/Senarai";
import { PenilaianWizard } from "@/components/PenilaianWizard";

/** HR / CEO: pratonton penilaian kendiri seperti yang dilihat pekerja (tiada apa-apa disimpan). */
export default function PratontonPenilaianPage() {
  return (
    <HadPeranan roles={["hr", "ceo", "admin"]} back="/pengurusan/prestasi">
      <Suspense fallback={<Loading />}>
        <Pratonton />
      </Suspense>
    </HadPeranan>
  );
}

function Pratonton() {
  const me = useMe();
  const router = useRouter();
  const kid = useSearchParams().get("k");
  const cid = me.active!.companyId;
  const d = useData(() => getKitaran(cid), [cid]);
  const k = d.data?.find((x) => x.id === kid) ?? null;
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Pratonton penilaian")} href="/pengurusan/prestasi" />
      {d.error && <ErrorBox message={d.error} />}
      {!d.data && !d.error && <Loading />}
      {d.data && !k && (
        <div className="px-4">
          <ErrorBox message={tr("Kitaran penilaian tidak dijumpai.")} />
        </div>
      )}
      {k && (
        <PenilaianWizard
          key={k.id}
          pratonton
          kitaran={k.name}
          tarikhAkhir={k.self_due}
          pelulus={tr("ketua jabatan anda")}
          items={k.template.map((t, i) => ({ ...t, id: `pratonton-${i}`, self_score: null, self_note: null }))}
          onSelesai={() => router.push("/pengurusan/prestasi")}
        />
      )}
    </Screen>
  );
}
