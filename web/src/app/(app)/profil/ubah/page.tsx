"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/ui";

/** Ubah profil kini dalam Profil Saya (setiap bahagian ada butang Ubah / Mohon kemas kini). */
export default function UbahProfilPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profil");
  }, [router]);
  return <Loading />;
}
