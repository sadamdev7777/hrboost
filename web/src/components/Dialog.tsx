"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Dialog sistem (ganti window.confirm / window.prompt): pengesahan & minta sebab.
 * Panggil `await sahkan({...})` atau `await mintaTeks({...})` dari mana-mana; <HosDialog /> dipasang sekali.
 */
type Permintaan =
  | { jenis: "sahkan"; tajuk: string; mesej?: string; ok: string; bahaya?: boolean; selesai: (v: boolean) => void }
  | { jenis: "teks"; tajuk: string; mesej?: string; label: string; ok: string; wajib: boolean; bahaya?: boolean; selesai: (v: string | null) => void };

let semasa: Permintaan | null = null;
const pendengar = new Set<() => void>();
const umum = () => pendengar.forEach((f) => f());

export function sahkan(o: { tajuk: string; mesej?: string; ok?: string; bahaya?: boolean }): Promise<boolean> {
  return new Promise((selesai) => {
    semasa = { jenis: "sahkan", ok: o.ok ?? "Teruskan", ...o, selesai };
    umum();
  });
}

export function mintaTeks(o: { tajuk: string; mesej?: string; label: string; ok?: string; wajib?: boolean; bahaya?: boolean }): Promise<string | null> {
  return new Promise((selesai) => {
    semasa = { jenis: "teks", ok: o.ok ?? "Hantar", wajib: o.wajib ?? true, ...o, selesai };
    umum();
  });
}

function tutup() {
  semasa = null;
  umum();
}

export function HosDialog() {
  const p = useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => pendengar.delete(f);
    },
    () => semasa,
    () => null,
  );
  const [teks, setTeks] = useState("");
  const [ralat, setRalat] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!p) return;
    const t = setTimeout(() => (p.jenis === "teks" ? input.current?.focus() : okBtn.current?.focus()), 0);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") batal();
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  });

  if (!p) return null;

  function batal() {
    if (!p) return;
    if (p.jenis === "sahkan") p.selesai(false);
    else p.selesai(null);
    setTeks("");
    setRalat(false);
    tutup();
  }
  function ok() {
    if (!p) return;
    if (p.jenis === "sahkan") p.selesai(true);
    else {
      if (p.wajib && !teks.trim()) return setRalat(true);
      p.selesai(teks.trim());
    }
    setTeks("");
    setRalat(false);
    tutup();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 lg:items-center lg:p-6" onClick={batal}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={p.tajuk}
        className="flex w-full max-w-[480px] flex-col gap-3 rounded-t-[20px] bg-surface px-4 pt-5 pb-5 lg:max-w-[440px] lg:rounded-[20px] lg:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-lg font-extrabold">{p.tajuk}</h2>
        {p.mesej && <p className="m-0 text-sm leading-normal text-subtle">{p.mesej}</p>}
        {p.jenis === "teks" && (
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#4A5A57]">
            {p.label}
            <textarea
              ref={input}
              rows={3}
              value={teks}
              onChange={(e) => {
                setTeks(e.target.value);
                setRalat(false);
              }}
              className="rounded-[12px] border border-[#D5DEDC] bg-surface px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-primary"
            />
            {ralat && <span className="text-xs font-semibold text-danger">Sila isi sebab.</span>}
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={batal} className="h-12 rounded-button border border-line bg-surface text-sm font-bold">
            Batal
          </button>
          <button
            ref={okBtn}
            type="button"
            onClick={ok}
            className={`h-12 rounded-button text-sm font-extrabold text-white ${p.bahaya ? "bg-danger" : "bg-primary"}`}
          >
            {p.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
