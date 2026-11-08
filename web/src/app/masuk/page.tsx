import type { Metadata } from "next";
import { KerangkaMasuk } from "./Pengepala";
import { EmelForm } from "./EmelForm";

export const metadata: Metadata = {
  title: "Log masuk · HRBoost.io",
};

export default function LoginPage() {
  return (
    <KerangkaMasuk>
      <EmelForm />
    </KerangkaMasuk>
  );
}
