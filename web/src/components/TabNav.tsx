"use client";

import { BottomNav } from "./ui";
import { getBilanganTugasan } from "@/lib/data";
import { useData } from "@/lib/useData";

/** Navigasi 4 tab dengan lencana bilangan tugasan kelulusan. */
export function TabNav() {
  const { data } = useData(getBilanganTugasan, []);
  return <BottomNav approvals={data ?? 0} />;
}
