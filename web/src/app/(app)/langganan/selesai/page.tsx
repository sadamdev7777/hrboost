"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { tarikh } from "@/lib/format";
import { getSatuInvois, rmSen, sahkanBayaran, type Invois } from "@/lib/langganan";
import { simpanAtauKongsiBil } from "@/lib/bilPdf";
import { ErrorBox, Loading, Screen } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

/** Kembali dari halaman bayaran CHIP: sahkan bayaran (cuba semula beberapa kali) dan papar resit. */
export default function SelesaiPage() {
  return (
    <Suspense fallback={null}>
      <Selesai />
    </Suspense>
  );
}

function Selesai() {
  const id = useSearchParams().get("inv") ?? "";
  const [inv, setInv] = useState<Invois | null>(null);
  const [keadaan, setKeadaan] = useState<"semak" | "dibayar" | "belum" | "ralat">("semak");
  const [ralat, setRalat] = useState<string | null>(null);
  // Syarikat baharu (pelan Langgan terus): teruskan ke persediaan syarikat selepas bayar
  const [persediaan, setPersediaan] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      for (let cuba = 0; cuba < 6 && !batal; cuba++) {
        try {
          const st = await sahkanBayaran(id);
          if (st === "paid") {
            const i = await getSatuInvois(id);
            const c = await getSupabase().from("companies").select("onboarding_completed_at").eq("id", i.company_id).maybeSingle();
            if (!batal) {
              setPersediaan(!!c.data && !c.data.onboarding_completed_at);
              setInv(i);
              setKeadaan("dibayar");
            }
            return;
          }
        } catch (e) {
          if (!batal) setRalat(e instanceof Error ? e.message : tr("Ralat"));
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!batal) setKeadaan(ralat ? "ralat" : "belum");
    })();
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Screen lebar="sempit">
      <main className="flex grow flex-col justify-center gap-4 px-6 py-10">
        {keadaan === "semak" && (
          <>
            <Loading />
            <p className="m-0 text-center text-sm text-subtle">{tr("Mengesahkan bayaran anda…")}</p>
          </>
        )}
        {keadaan === "dibayar" && inv && (
          <>
            <h1 className="m-0 text-2xl font-extrabold">{tr("Terima kasih!")}</h1>
            <p className="m-0 text-sm leading-normal text-subtle">
              {tr("Bayaran {0} diterima. Langganan HRBoost aktif sehingga {1}. Resit rasmi juga dihantar ke e-mel anda.", rmSen(inv.total_sen), tarikh(inv.period_end!))}
            </p>
            <button type="button" onClick={() => simpanAtauKongsiBil(inv, "resit", false)} className="h-12 rounded-button bg-primary text-base font-extrabold text-white">
              {tr("Muat turun resit {0}", inv.receipt_number ?? "")}
            </button>
            {persediaan ? (
              <Link href="/mula" className="flex h-12 items-center justify-center rounded-button border-2 border-primary text-base font-extrabold text-primary!">
                {tr("Teruskan persediaan syarikat")}
              </Link>
            ) : (
              <Link href="/pengurusan" className="flex h-12 items-center justify-center rounded-button border border-line text-base font-bold text-ink!">
                {tr("Ke Papan Pemuka")}
              </Link>
            )}
          </>
        )}
        {(keadaan === "belum" || keadaan === "ralat") && (
          <>
            <h1 className="m-0 text-2xl font-extrabold">{tr("Bayaran belum diterima")}</h1>
            <p className="m-0 text-sm leading-normal text-subtle">
              {tr("Jika anda telah membayar, pengesahan mungkin mengambil masa beberapa minit. Jika bayaran dibatalkan, anda boleh cuba lagi.")}
            </p>
            {ralat && <ErrorBox message={ralat} />}
            <Link href="/pengurusan/langganan" className="flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white!">
              {tr("Kembali ke Langganan")}
            </Link>
          </>
        )}
      </main>
    </Screen>
  );
}
