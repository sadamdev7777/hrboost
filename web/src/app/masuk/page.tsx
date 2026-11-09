import { tr } from "@/lib/i18n";
import type { Metadata } from "next";
import { KerangkaMasuk } from "./Pengepala";
import { EmelForm } from "./EmelForm";

export const metadata: Metadata = {
  title: tr("Log masuk · HRBoost.io"),
};

export default function LoginPage() {
  return (
    <KerangkaMasuk>
      <EmelForm />
    </KerangkaMasuk>
  );
}
