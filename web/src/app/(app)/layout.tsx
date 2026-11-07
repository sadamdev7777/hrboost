import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

// Semua halaman pekerja (perlu log masuk). Data dimuatkan di pelayar dengan kunci anon;
// RLS pangkalan data menentukan apa yang boleh dilihat oleh setiap pengguna.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
