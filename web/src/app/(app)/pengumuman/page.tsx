"use client";

import { tr } from "@/lib/i18n";
import { useMe } from "@/lib/me";
import { useData } from "@/lib/useData";
import { getPengumuman, tandaDibaca } from "@/lib/urusan";
import { BackHeader, ErrorBox, Loading, Screen } from "@/components/ui";
import { ItemPengumuman } from "@/components/Pengumuman";

export default function PengumumanPage() {
  const me = useMe();
  const emp = me.active!;
  const d = useData(() => getPengumuman(emp.companyId), [emp.companyId]);
  return (
    <Screen lebar="sederhana">
      <BackHeader title={tr("Pengumuman")} href="/saya" />
      <main className="flex grow flex-col gap-3 px-4 pt-1 pb-6">
        {d.error && <ErrorBox message={d.error} />}
        {d.loading && !d.data && <Loading />}
        {d.data && d.data.length === 0 && <div className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted">{tr("Tiada pengumuman.")}</div>}
        {(d.data ?? []).length > 0 && (
          <div className="flex flex-col rounded-card bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-[#EEF2F1]">
            {(d.data ?? []).map((a) => (
              <ItemPengumuman
                key={a.id}
                a={a}
                onBaca={async () => {
                  await tandaDibaca(a.id).catch(() => undefined);
                  d.reload();
                }}
              />
            ))}
          </div>
        )}
      </main>
    </Screen>
  );
}
