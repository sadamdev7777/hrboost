"use client";

import { useEffect, useRef, useState } from "react";

/** Lembaran bawah untuk memasukkan sebab (wajib untuk Tolak / Kembalikan). */
export function ReasonSheet({
  title,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-[480px] flex-col gap-3 rounded-t-[20px] bg-surface px-4 pt-5 pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-lg font-extrabold">{title}</h2>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Sebab
          <textarea
            ref={ref}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-xl border border-line bg-surface p-3 text-sm font-normal text-ink"
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-[14px] border border-line bg-surface text-sm font-bold text-ink"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
              } finally {
                setBusy(false);
              }
            }}
            className={`h-12 rounded-[14px] text-sm font-extrabold text-white disabled:opacity-60 ${
              danger ? "bg-danger" : "bg-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
