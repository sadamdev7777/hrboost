"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { Loading } from "@/components/ui";

const MENU = [
  { href: "/admin", label: tr("Ringkasan") },
  { href: "/admin/syarikat", label: tr("Syarikat") },
  { href: "/admin/pengguna", label: tr("Pengguna") },
  { href: "/admin/akses", label: tr("Permohonan akses") },
  { href: "/admin/log", label: tr("Log audit") },
  { href: "/admin/ralat", label: tr("Ralat aplikasi") },
  { href: "/admin/tetapan", label: tr("Tetapan platform") },
];

type Keadaan = "loading" | "keluar" | "bukan" | "ok";

/** Konsol Pentadbir Platform (desktop). Akses sebenar dikawal oleh RPC sa_* (is_superadmin). */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [k, setK] = useState<Keadaan>("loading");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let batal = false;
    (async () => {
      const sb = getSupabase();
      const { data: s } = await sb.auth.getSession();
      if (!s.session) {
        if (!batal) setK("keluar");
        router.replace("/masuk");
        return;
      }
      const { data } = await sb.rpc("sa_dashboard");
      if (batal) return;
      if (!data) return setK("bukan");
      const { data: ls } = await sb.rpc("my_login_status");
      if (batal) return;
      if (ls && !(ls as { has_password?: boolean }).has_password) {
        router.replace(`/akaun/kata-laluan?seterusnya=${encodeURIComponent(path)}`);
        return;
      }
      setPending(Number((data as { grants_pending?: number }).grants_pending ?? 0));
      setK("ok");
    })();
    return () => {
      batal = true;
    };
  }, [router, path]);

  if (k === "loading" || k === "keluar") return <Loading />;
  if (k === "bukan")
    return (
      <div className="mx-auto max-w-[480px] p-8">
        <h1 className="text-2xl font-extrabold">{tr("Tiada akses")}</h1>
        <p className="text-subtle">{tr("Halaman ini hanya untuk Pentadbir Platform HRBoost.")}</p>
        <Link href="/utama" className="font-bold">
          {tr("Kembali ke aplikasi")}</Link>
      </div>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-page text-ink md:flex-row">
      <nav aria-label={tr("Menu pentadbir platform")} className="flex shrink-0 flex-col gap-1 bg-surface p-4 md:min-h-dvh md:w-[240px] md:border-r md:border-line-soft">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-sm font-extrabold text-white">HR</span>
          <span className="flex flex-col">
            <b className="text-[15px] font-extrabold">HRBoost.io</b>
            <span className="text-xs text-muted">{tr("Pentadbir Platform")}</span>
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto md:flex-col">
          {MENU.map((m) => {
            const on = m.href === "/admin" ? path === "/admin" : path.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-[10px] px-3 text-sm font-bold ${on ? "bg-[#E3F1EE] text-primary!" : "text-[#4A5A57]!"}`}
              >
                {tr(m.label)}
                {m.href === "/admin/akses" && pending > 0 && <span className="rounded-full bg-warning px-2 text-xs text-white">{pending}</span>}
              </Link>
            );
          })}
        </div>
        <span className="hidden grow md:block" />
        <button
          type="button"
          onClick={async () => {
            await getSupabase().auth.signOut();
            router.replace("/masuk");
          }}
          className="mt-2 hidden min-h-11 rounded-[10px] px-3 text-left text-sm font-bold text-danger md:block"
        >
          {tr("Log keluar")}</button>
      </nav>
      <main className="flex min-w-0 grow flex-col gap-5 p-5 md:p-8">{children}</main>
    </div>
  );
}
