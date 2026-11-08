import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/ui";
import { AdminShell } from "./AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
