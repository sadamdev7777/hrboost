import { tr } from "@/lib/i18n";
import type { Metadata } from "next";
import { KerangkaMasuk } from "../Pengepala";
import { LoginForm } from "../LoginForm";

export const metadata: Metadata = {
  title: tr("Log masuk dengan WhatsApp · HRBoost.io"),
};

// Rujukan reka bentuk: design/Login.dc.html — log masuk kali pertama (sahkan nombor telefon)
export default function TelefonPage() {
  return (
    <KerangkaMasuk>
      <LoginForm />
    </KerangkaMasuk>
  );
}
