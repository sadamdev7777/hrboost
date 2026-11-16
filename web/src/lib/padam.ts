"use client";

import { tr, trRalat } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { must } from "@/lib/useData";
import { beritahu } from "@/components/Dialog";

/**
 * Padam dengan sejarah (deleted_records) + pulihkan. Rekod dipadam disimpan kekal dan boleh dipulihkan
 * di Tetapan → Rekod dipadam. Rekod berkanun (gaji, pekerja, permohonan yang dihantar) tidak dipadam di sini.
 */
export type EntitiPadam =
  | "letter" | "announcement" | "department" | "asset" | "document" | "family" | "training" | "timeline"
  | "checklist" | "delegation" | "question" | "appraisal_cycle" | "kb_doc" | "tp1" | "claim_draft";

export const LABEL_ENTITI = (): Record<EntitiPadam, string> => ({
  letter: tr("Surat"),
  announcement: tr("Pengumuman"),
  department: tr("Jabatan"),
  asset: tr("Inventori"),
  document: tr("Dokumen pekerja"),
  family: tr("Keluarga"),
  training: tr("Latihan & sijil"),
  timeline: tr("Sejarah kerja"),
  checklist: tr("Senarai semak orientasi"),
  delegation: tr("Wakil kelulusan"),
  question: tr("Soalan HR"),
  appraisal_cycle: tr("Kitaran penilaian"),
  kb_doc: tr("Pengetahuan AI"),
  tp1: tr("Pelepasan TP1"),
  claim_draft: tr("Draf tuntutan"),
});

/** Padam satu rekod (salinan disimpan). Memaparkan mesej dengan butang "Buat asal". */
export async function padamRekod(entiti: EntitiPadam, id: string, sebab?: string | null, selepasPulih?: () => void): Promise<string> {
  const { data, error } = await getSupabase().rpc("record_delete", { p_entity: entiti, p_id: id, p_reason: sebab ?? undefined });
  if (error) throw new Error(trRalat(error.message));
  const rid = data as string;
  beritahu(tr("{0} dipadam. Boleh dipulihkan di Tetapan → Rekod dipadam.", LABEL_ENTITI()[entiti]), "ok", {
    label: tr("Buat asal"),
    buat: async () => {
      try {
        await pulihkanRekod(rid);
        beritahu(tr("Dipulihkan."));
        selepasPulih?.();
      } catch (e) {
        beritahu(e instanceof Error ? e.message : tr("Ralat"), "ralat");
      }
    },
  });
  return rid;
}

export async function pulihkanRekod(id: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("record_restore", { p_id: id });
  if (error) throw new Error(trRalat(error.message));
  return data as string;
}

export type RekodDipadam = {
  id: string;
  entity: EntitiPadam;
  record_id: string;
  label: string;
  detail: string | null;
  reason: string | null;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
  restored_by: string | null;
  can_restore: boolean;
};

export async function getRekodDipadam(companyId: string, termasukDipulih = false): Promise<RekodDipadam[]> {
  return (must(await getSupabase().rpc("deleted_records_list", { p_company: companyId, p_include_restored: termasukDipulih })) ?? []) as RekodDipadam[];
}
