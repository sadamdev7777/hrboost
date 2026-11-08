"use client";

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
    <Screen>
      <BackHeader href="/masuk" />
      <form
        className="flex grow flex-col gap-4 px-6 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = tokenDaripada(link);
          if (!t) {
            setError("Pautan tidak sah. Salin pautan penuh daripada mesej WhatsApp HR.");
            return;
          }
          router.push(`/jemputan/${t}`);
        }}
      >
        <h1 className="m-0 text-[22px] font-extrabold">Pautan jemputan</h1>
        <p className="m-0 text-sm leading-normal text-subtle">
          HR telah menghantar pautan jemputan ke WhatsApp anda. Tekan pautan itu, atau salin dan tampal di sini.
        </p>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Pautan jemputan
          <input
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
          Teruskan
        </button>
      </form>
    </Screen>
  );
}
