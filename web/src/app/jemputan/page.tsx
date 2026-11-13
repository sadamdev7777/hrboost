"use client";

import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { tokenDaripada } from "@/lib/invite";
import { BackHeader, ErrorBox, Screen } from "@/components/ui";

// Untuk pekerja yang mempunyai pautan jemputan tetapi membuka aplikasi secara terus.
export default function JemputanPage() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen lebar="sempit">
      <BackHeader href="/masuk" />
      <form
        className="flex grow flex-col gap-4 px-6 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = tokenDaripada(link);
          if (!t) {
            setError(tr("Pautan tidak sah. Salin pautan penuh daripada mesej HR."));
            return;
          }
          router.push(`/jemputan/${t}`);
        }}
      >
        <h1 className="m-0 text-[22px] font-extrabold">{tr("Pautan jemputan")}</h1>
        <p className="m-0 text-sm leading-normal text-subtle">
          {tr("Buka pautan jemputan yang dihantar oleh HR, atau salin dan tampal di sini.")}</p>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          {tr("Pautan jemputan")}<input
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…/jemputan/…"
            className="h-12 rounded-[14px] border-[1.5px] border-primary bg-surface px-4 text-base font-semibold text-ink"
          />
        </label>
        {error && <ErrorBox message={error} />}
        <button
          type="submit"
          className="mt-2 flex h-12 items-center justify-center rounded-button bg-primary text-base font-extrabold text-white hover:bg-primary-hover"
        >
          {tr("Teruskan")}</button>
        <div className="mt-2 flex flex-col gap-2 rounded-card bg-surface px-4 py-4 text-[13px] leading-normal text-[#4A5A57]">
          <b className="text-sm text-ink">{tr("Tidak jumpa pautan?")}</b>
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">
            <li>{tr("Buka WhatsApp dan cari mesej daripada HRBoost bertajuk “anda dijemput menyertai”.")}</li>
            <li>{tr("Pautan sah selama 7 hari. Jika telah tamat, minta HR anda menghantar jemputan semula.")}</li>
            <li>{tr("Tiada WhatsApp? HR boleh menyalin pautan dan menghantarnya melalui e-mel atau SMS.")}</li>
          </ol>
          <span>
            {tr("Sudah mengaktifkan akaun?")}{" "}
            <a href="/masuk" className="font-bold">
              {tr("Log masuk")}</a>
          </span>
        </div>
      </form>
    </Screen>
  );
}
