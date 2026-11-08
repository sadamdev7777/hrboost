"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getTuntutanSaya } from "@/lib/claims";
import { ClaimForm } from "@/components/ClaimForm";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";

// Draf / tuntutan dikembalikan boleh diubah; yang lain dibuka sebagai butiran permohonan.
export default function TuntutanPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const list = useData(() => getTuntutanSaya(me.active!), [me.active?.id]);
  const t = list.data?.find((x) => x.id === id);
  const bolehUbah = t && (t.status === "draft" || t.status === "returned");

  useEffect(() => {
    if (t && !bolehUbah && t.approvalRequestId) router.replace(`/permohonan/${t.approvalRequestId}`);
  }, [t, bolehUbah, router]);

  if (list.data && !t) {
    return (
      <Screen>
        <BackHeader title="Tuntutan" href="/tuntutan" />
        <div className="p-5">
          <ErrorBox message="Tuntutan tidak dijumpai." />
        </div>
      </Screen>
    );
  }
  if (!t || !bolehUbah || !t.item) {
    return (
      <Screen>
        <BackHeader title="Tuntutan" href="/tuntutan" />
        <Loading />
      </Screen>
    );
  }
  return <ClaimForm claimId={t.id} initial={t.item} />;
}
