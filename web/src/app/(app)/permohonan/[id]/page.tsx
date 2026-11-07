"use client";

import { useParams } from "next/navigation";
import { RequestDetail } from "@/components/RequestDetail";

export default function PermohonanButiranPage() {
  const { id } = useParams<{ id: string }>();
  return <RequestDetail mode={{ kind: "requester", requestId: id }} />;
}
