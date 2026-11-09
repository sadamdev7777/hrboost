"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasRole, useMeContext } from "@/lib/me";
import { getSenaraiPekerja, type PekerjaRingkas } from "@/lib/hr";
import { inisial } from "@/lib/format";

type Hasil = { key: string; label: string; sub: string; href: string; jenis: "pekerja" | "tindakan" };

const TINDAKAN: { label: string; sub: string; href: string; roles: string[]; kata: string }[] = [
  { label: "Tambah pekerja", sub: "Tindakan", href: "/pengurusan/pekerja/baru", roles: ["hr", "admin"], kata: "tambah baru pekerja daftar" },
  { label: "Kelulusan", sub: "Permohonan menunggu", href: "/kelulusan", roles: ["hr", "finance", "ceo", "admin"], kata: "lulus kelulusan cuti tuntutan" },
  { label: "Proses gaji", sub: "Gaji bulan ini", href: "/pengurusan/gaji", roles: ["hr", "finance", "admin"], kata: "gaji payroll proses slip" },
  { label: "Gaji pekerja", sub: "Gaji pokok & elaun", href: "/pengurusan/gaji/pekerja", roles: ["hr", "finance", "admin"], kata: "gaji pokok elaun kwsp" },
  { label: "Sejarah gaji", sub: "Bulan-bulan lepas & fail", href: "/pengurusan/gaji/sejarah", roles: ["hr", "finance", "admin"], kata: "sejarah gaji fail bank kwsp perkeso" },
  { label: "Kalendar pasukan", sub: "Siapa bercuti bulan ini", href: "/kalendar", roles: ["hr", "finance", "ceo", "admin"], kata: "kalendar cuti pasukan bercuti jadual calendar" },
  { label: "Surat", sub: "Permohonan surat pengesahan", href: "/pengurusan/surat", roles: ["hr", "admin"], kata: "surat pengesahan majikan gaji pinjaman bank letter" },
  { label: "Pengumuman", sub: "Hantar kepada semua pekerja", href: "/pengurusan/pengumuman", roles: ["hr", "ceo", "admin"], kata: "pengumuman notis announcement whatsapp semua" },
  { label: "Soalan HR", sub: "Soalan pekerja yang belum dijawab", href: "/pengurusan/soalan", roles: ["hr", "admin"], kata: "soalan tanya hr helpdesk jawab" },
  { label: "Kerja fleksibel", sub: "Permohonan susunan kerja fleksibel", href: "/pengurusan/kerja-fleksibel", roles: ["hr", "admin"], kata: "kerja fleksibel rumah wfh flexible waktu" },
  { label: "Pendahuluan gaji", sub: "Gaji → Pendahuluan", href: "/pengurusan/gaji/pendahuluan", roles: ["hr", "finance", "admin"], kata: "pendahuluan gaji advance pinjaman" },
  { label: "Laporan", sub: "Pekerja, cuti, kehadiran, tuntutan, kos gaji", href: "/pengurusan/laporan", roles: ["hr", "finance", "ceo", "admin"], kata: "laporan report pusing ganti baki cuti kehadiran lewat tuntutan kos gaji eksport csv" },
  { label: "Jabatan & ketua", sub: "Tetapan", href: "/pengurusan/tetapan/jabatan", roles: ["hr", "admin"], kata: "jabatan ketua department" },
  { label: "Cuti umum", sub: "Tetapan", href: "/pengurusan/tetapan/cuti-umum", roles: ["hr", "admin"], kata: "cuti umum public holiday" },
  { label: "Jenis cuti", sub: "Tetapan", href: "/pengurusan/tetapan/cuti", roles: ["hr", "admin"], kata: "jenis cuti kelayakan" },
  { label: "Tetapan", sub: "Semua tetapan syarikat", href: "/pengurusan/tetapan", roles: ["hr", "finance", "ceo", "admin"], kata: "tetapan setting" },
];

const PERISTIWA = "hrb-cari";
/** Buka carian pantas dari mana-mana butang. */
export function bukaCari() {
  window.dispatchEvent(new Event(PERISTIWA));
}

/** Carian pantas (Ctrl+K / ⌘K): pekerja & tindakan HR. Dipasang sekali dalam AppShell. */
export function CariPantas() {
  const { state } = useMeContext();
  const me = state.status === "ready" ? state.me : null;
  const boleh = !!me?.active && hasRole(me, ["hr", "finance", "ceo", "admin"]);
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState("");
  const [ppl, setPpl] = useState<PekerjaRingkas[] | null>(null);
  const [aktif, setAktif] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!boleh) return;
    const kekunci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuka((b) => !b);
      }
    };
    const peristiwa = () => setBuka(true);
    window.addEventListener("keydown", kekunci);
    window.addEventListener(PERISTIWA, peristiwa);
    return () => {
      window.removeEventListener("keydown", kekunci);
      window.removeEventListener(PERISTIWA, peristiwa);
    };
  }, [boleh]);

  useEffect(() => {
    if (!buka || !me?.active || ppl) return;
    let batal = false;
    getSenaraiPekerja(me.active.companyId)
      .then((x) => !batal && setPpl(x))
      .catch(() => !batal && setPpl([]));
    return () => {
      batal = true;
    };
  }, [buka, me?.active, ppl]);

  useEffect(() => {
    if (buka) setTimeout(() => input.current?.focus(), 0);
  }, [buka]);

  const hasil = useMemo<Hasil[]>(() => {
    if (!me) return [];
    const t = q.trim().toLowerCase();
    const orang = (ppl ?? [])
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.employeeNo.toLowerCase().includes(t) || (p.department ?? "").toLowerCase().includes(t))
      .slice(0, t ? 8 : 5)
      .map((p) => ({ key: p.id, label: p.name, sub: [p.department, p.employeeNo].filter(Boolean).join(" · "), href: `/pengurusan/pekerja/${p.id}`, jenis: "pekerja" as const }));
    const aksi = TINDAKAN.filter((a) => hasRole(me, a.roles as Parameters<typeof hasRole>[1]))
      .filter((a) => !t || a.label.toLowerCase().includes(t) || a.kata.includes(t))
      .slice(0, 6)
      .map((a) => ({ key: a.href, label: a.label, sub: a.sub, href: a.href, jenis: "tindakan" as const }));
    return [...orang, ...aksi];
  }, [q, ppl, me]);

  if (!boleh || !buka) return null;

  const pergi = (h: Hasil) => {
    setBuka(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-3 pt-[10vh]" onClick={() => setBuka(false)}>
      <div role="dialog" aria-modal="true" aria-label="Carian pantas" className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[18px] bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAktif(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setBuka(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setAktif((a) => Math.min(a + 1, hasil.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAktif((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && hasil[aktif]) pergi(hasil[aktif]);
          }}
          placeholder="Cari pekerja, jabatan atau tindakan…"
          aria-label="Cari"
          className="h-14 border-b border-line-soft px-5 text-base outline-none"
        />
        <div className="flex max-h-[60vh] flex-col overflow-y-auto py-1.5">
          {ppl === null && <span className="px-5 py-3 text-sm text-muted">Memuatkan…</span>}
          {ppl !== null && hasil.length === 0 && <span className="px-5 py-3 text-sm text-muted">Tiada hasil untuk &ldquo;{q}&rdquo;.</span>}
          {hasil.map((h, i) => (
            <button
              key={h.jenis + h.key}
              type="button"
              onMouseEnter={() => setAktif(i)}
              onClick={() => pergi(h)}
              className={`flex min-h-12 items-center gap-3 px-5 py-2 text-left ${i === aktif ? "bg-[#E3F1EE]" : ""}`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${h.jenis === "pekerja" ? "bg-[#FDEBD7] text-warning" : "bg-[#E3F1EE] text-primary"}`}
              >
                {h.jenis === "pekerja" ? inisial(h.label) : "›"}
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-sm">{h.label}</b>
                <span className="truncate text-xs text-muted">{h.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-4 border-t border-line-soft px-5 py-2 text-[11px] text-muted">
          <span>↑↓ pilih</span>
          <span>Enter buka</span>
          <span>Esc tutup</span>
        </div>
      </div>
    </div>
  );
}
