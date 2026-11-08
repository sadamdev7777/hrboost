"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useData } from "@/lib/useData";
import { getSlip } from "@/lib/gaji";
import { SlipGajiCetak } from "@/components/SlipGajiCetak";
import { HadPeranan } from "@/components/Senarai";
import { Loading } from "@/components/ui";

// Pratonton slip bagi HR / Kewangan (setiap pembukaan direkodkan dalam data_access_log)
export default function PratontonSlipPage() {
  return (
    <HadPeranan roles={["hr", "finance", "ceo", "admin"]} back="/pengurusan/gaji">
      <Suspense fallback={<Loading />}>
        <Pratonton />
      </Suspense>
    </HadPeranan>
  );
}

function Pratonton() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const d = useData(() => getSlip(id), [id]);
  return <SlipGajiCetak d={d} back={`/pengurusan/gaji${sp.get("run") ? `?run=${sp.get("run")}` : ""}`} />;
}
