"use client";

import { useParams } from "next/navigation";
import { RequestDetail } from "@/components/RequestDetail";

// Rujukan reka bentuk: design/Butiran.dc.html
export default function KelulusanButiranPage() {
  const { id } = useParams<{ id: string }>();
  return <RequestDetail mode={{ kind: "approver", taskId: id }} />;
}
