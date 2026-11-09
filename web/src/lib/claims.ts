"use client";

import { tr, trRalat } from "@/lib/i18n";
import { getSupabase } from "./supabase";
import { must } from "./useData";
import { namaPeringkat, type StatusPermohonan } from "./format";
import type { Pekerjaan } from "./me";

/** Nama paparan BM bagi jenis tuntutan lalai (CLAUDE.md: perbatuan, letak kereta). HR boleh menamakan semula. */
const LABEL: Record<string, string> = {
  Mileage: tr("Perbatuan"),
  "Parking & Tol": tr("Letak kereta & Tol"),
  "Grab / Teksi": tr("E-hailing / Teksi"),
  "Makan (outstation)": tr("Makan (luar kawasan)"),
};
export const namaJenisTuntutan = (n: string) => LABEL[n] ?? trRalat(n);

export type JenisTuntutan = {
  id: string;
  name: string;
  label: string;
  requiresReceipt: boolean;
  mileageRate: number | null;
  limitPerItem: number | null;
};

export async function getJenisTuntutan(companyId: string): Promise<JenisTuntutan[]> {
  const rows = must(
    await getSupabase()
      .from("claim_types")
      .select("id, name, requires_receipt, mileage_rate, limit_per_item")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
  );
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      label: namaJenisTuntutan(r.name),
      requiresReceipt: r.requires_receipt,
      mileageRate: r.mileage_rate === null ? null : Number(r.mileage_rate),
      limitPerItem: r.limit_per_item === null ? null : Number(r.limit_per_item),
    }))
    .sort((a, b) => Number(!!a.mileageRate) - Number(!!b.mileageRate) || a.label.localeCompare(b.label, "ms"));
}

/** Peringkat kelulusan tuntutan untuk paparan: "Ketua Jabatan → Kewangan. Melebihi RM1,000 → CEO juga." */
export async function getAliranTuntutan(companyId: string): Promise<string | null> {
  const wf = must(
    await getSupabase()
      .from("approval_workflows")
      .select("approval_workflow_steps(step_order, name, condition)")
      .eq("company_id", companyId)
      .eq("request_type", "claim")
      .eq("active", true)
      .maybeSingle(),
  );
  const steps = (wf?.approval_workflow_steps ?? []).sort((a, b) => a.step_order - b.step_order);
  if (!steps.length) return null;
  const biasa = steps.filter((s) => !s.condition || Object.keys(s.condition as object).length === 0).map((s) => namaPeringkat(s.name));
  const bersyarat = steps
    .filter((s) => s.condition && Object.keys(s.condition as object).length > 0)
    .map((s) => {
      const c = s.condition as { field?: string; op?: string; value?: number };
      return c.field === "amount" && c.op === ">" && typeof c.value === "number"
        ? tr("Melebihi RM{0} → {1} juga.", c.value.toLocaleString("en-MY"), namaPeringkat(s.name))
        : tr("{0} (bersyarat).", namaPeringkat(s.name));
    });
  return [tr("Akan diluluskan oleh: {0}.", biasa.join(" → ")), ...bersyarat].join(" ");
}

export type ItemTuntutan = {
  claimTypeId: string;
  date: string;
  amount: number;
  purpose: string;
  distanceKm: number | null;
  receipts: string[];
};

export type Tuntutan = {
  id: string;
  title: string;
  status: StatusPermohonan;
  total: number;
  paidAt: string | null;
  approvalRequestId: string | null;
  createdAt: string;
  item: (ItemTuntutan & { typeName: string }) | null;
  waitingFor: string | null;
};

export async function getTuntutanSaya(emp: Pekerjaan): Promise<Tuntutan[]> {
  const sb = getSupabase();
  const rows = must(
    await sb
      .from("claims")
      .select(
        "id, title, status, total_amount, paid_at, approval_request_id, created_at, claim_items(claim_type_id, expense_date, amount, description, distance_km, receipt_paths, claim_types(name))",
      )
      .eq("employment_id", emp.id)
      .order("created_at", { ascending: false }),
  );
  const req = must(await sb.from("v_my_requests").select("request_id, waiting_for").eq("request_type", "claim"));
  return rows.map((c) => {
    const i = c.claim_items[0];
    const sum = c.claim_items.reduce((s, x) => s + Number(x.amount), 0);
    return {
      id: c.id,
      title: c.title,
      status: c.status as StatusPermohonan,
      total: Number(c.total_amount) || sum,
      paidAt: c.paid_at,
      approvalRequestId: c.approval_request_id,
      createdAt: c.created_at,
      item: i
        ? {
            claimTypeId: i.claim_type_id,
            date: i.expense_date,
            amount: Number(i.amount),
            purpose: i.description ?? c.title,
            distanceKm: i.distance_km === null ? null : Number(i.distance_km),
            receipts: i.receipt_paths ?? [],
            typeName: namaJenisTuntutan(i.claim_types?.name ?? ""),
          }
        : null,
      waitingFor: req.find((r) => r.request_id === c.approval_request_id)?.waiting_for ?? null,
    };
  });
}

/** Simpan tuntutan sebagai draf (cipta baharu atau kemas kini draf/dikembalikan). Memulangkan id tuntutan. */
export async function simpanDraf(employmentId: string, item: ItemTuntutan, claimId?: string): Promise<string> {
  const sb = getSupabase();
  const title = item.purpose.trim() || tr("Tuntutan");
  let id = claimId;
  if (id) {
    must(await sb.from("claims").update({ title }).eq("id", id));
    must(await sb.from("claim_items").delete().eq("claim_id", id));
  } else {
    const c = must(await sb.from("claims").insert({ employment_id: employmentId, title, status: "draft" }).select("id").single());
    id = c.id;
  }
  must(
    await sb.from("claim_items").insert({
      claim_id: id,
      claim_type_id: item.claimTypeId,
      expense_date: item.date,
      amount: item.amount,
      description: item.purpose.trim() || null,
      distance_km: item.distanceKm,
      receipt_path: item.receipts[0] ?? null,
      receipt_paths: item.receipts,
    }),
  );
  return id!;
}

export async function hantarTuntutan(claimId: string) {
  must(await getSupabase().rpc("submit_claim", { p_claim: claimId, p_via: "web" }));
}

export async function padamDraf(claimId: string) {
  must(await getSupabase().from("claims").delete().eq("id", claimId));
}
