import { redirect } from "next/navigation";

// Homepage (design/Homepage.dc.html) dibina dalam Fasa G.
// Buat sementara, halaman utama terus ke halaman log masuk.
export default function Home() {
  redirect("/masuk");
}
