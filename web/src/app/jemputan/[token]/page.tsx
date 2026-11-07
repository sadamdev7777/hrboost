import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading, Screen } from "@/components/ui";
import { Daftar } from "./Daftar";

export const metadata: Metadata = {
  title: "Jemputan · HRBoost.io",
};

// Rujukan reka bentuk: design/Daftar.dc.html
export default function DaftarPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <Loading />
        </Screen>
      }
    >
      <Daftar />
    </Suspense>
  );
}
