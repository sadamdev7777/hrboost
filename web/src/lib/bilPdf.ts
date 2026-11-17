"use client";

import { tr } from "@/lib/i18n";
import { benamLogoHRBoost, simpanAtauKongsiPdf } from "@/lib/slipPdf";
import { rmSen, type Invois } from "@/lib/langganan";

// Invois & resit langganan HRBoost (A4) dijana dalam pelayar, atas nama HRBoost (penjual) kepada syarikat (pembeli).

const selamat = (t: string) => t.replace(/[^\x20-\x7E -ÿ–—‘’“”·\n]/g, "?");
const tarikhPdf = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
};

export async function janaBilPdf(inv: Invois, jenis: "invois" | "resit"): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const resit = jenis === "resit";
  doc.setTitle(`${resit ? tr("Resit") : tr("Invois")} ${resit ? inv.receipt_number : inv.number}`);
  doc.setProducer("HRBoost.io");
  doc.setCreator("HRBoost.io");
  const page = doc.addPage([595.28, 841.89]);
  const biasa = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const HIJAU = rgb(15 / 255, 107 / 255, 95 / 255);
  const DAKWAT = rgb(20 / 255, 33 / 255, 31 / 255);
  const KELABU = rgb(91 / 255, 107 / 255, 104 / 255);
  const GARIS = rgb(0.86, 0.89, 0.88);
  const M = 48;
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  const teks = (t: string, x: number, yy: number, o: { saiz?: number; b?: boolean; warna?: ReturnType<typeof rgb>; kanan?: boolean } = {}) => {
    const s = selamat(t);
    const f = o.b ? tebal : biasa;
    const saiz = o.saiz ?? 10;
    const w = f.widthOfTextAtSize(s, saiz);
    page.drawText(s, { x: o.kanan ? x - w : x, y: yy, size: saiz, font: f, color: o.warna ?? DAKWAT });
  };
  const baris = (t: string, x: number, yy: number, lebar: number, o: { saiz?: number; warna?: ReturnType<typeof rgb> } = {}) => {
    const saiz = o.saiz ?? 9.5;
    let line = "";
    let n = 0;
    for (const p of selamat(t).split(/\s+/)) {
      const cuba = line ? line + " " + p : p;
      if (biasa.widthOfTextAtSize(cuba, saiz) > lebar && line) {
        teks(line, x, yy - n * (saiz + 3), { saiz, warna: o.warna });
        n++;
        line = p;
      } else line = cuba;
    }
    if (line) teks(line, x, yy - n * (saiz + 3), { saiz, warna: o.warna });
    return (n + 1) * (saiz + 3);
  };

  // Kepala: logo teks HRBoost + butiran penjual (kiri), jenis dokumen (kanan)
  const logo = await benamLogoHRBoost(doc);
  if (logo) {
    const t = 22;
    page.drawImage(logo, { x: M, y: y - t, width: (logo.width / logo.height) * t, height: t });
  } else {
    teks("HRBoost", M, y - 18, { saiz: 18, b: true, warna: HIJAU });
  }
  teks(resit ? tr("RESIT RASMI") : tr("INVOIS"), M + W, y - 16, { saiz: 18, b: true, warna: HIJAU, kanan: true });
  y -= 40;
  const s = inv.seller ?? {};
  let yk = y;
  teks(s.name || "HRBoost", M, yk, { b: true });
  yk -= 13;
  if (s.ssm) {
    teks(tr("No. SSM: {0}", s.ssm), M, yk, { saiz: 9, warna: KELABU });
    yk -= 12;
  }
  if (s.address) yk -= baris(s.address, M, yk, W * 0.5, { saiz: 9, warna: KELABU });
  if (s.email || s.phone) {
    teks([s.email, s.phone].filter(Boolean).join(" · "), M, yk, { saiz: 9, warna: KELABU });
    yk -= 12;
  }
  // Nombor & tarikh (kanan)
  const kanan = [
    [resit ? tr("No. resit") : tr("No. invois"), (resit ? inv.receipt_number : inv.number) ?? "-"],
    resit ? [tr("No. invois"), inv.number] : null,
    [tr("Tarikh"), tarikhPdf(resit ? inv.paid_at : inv.created_at)],
    [tr("Status"), inv.status === "paid" ? tr("DIBAYAR") : tr("BELUM DIBAYAR")],
  ].filter(Boolean) as string[][];
  let yr = y;
  for (const [k, v] of kanan) {
    teks(k, M + W - 150, yr, { saiz: 9, warna: KELABU });
    teks(v, M + W, yr, { saiz: 9, b: true, kanan: true });
    yr -= 13;
  }
  y = Math.min(yk, yr) - 14;

  // Pembeli
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: GARIS });
  y -= 18;
  teks(resit ? tr("DITERIMA DARIPADA") : tr("DIBILKAN KEPADA"), M, y, { saiz: 8.5, b: true, warna: KELABU });
  y -= 14;
  teks(inv.buyer?.name ?? "-", M, y, { b: true });
  y -= 13;
  if (inv.buyer?.reg_no) {
    teks(tr("No. SSM: {0}", inv.buyer.reg_no), M, y, { saiz: 9, warna: KELABU });
    y -= 12;
  }
  if (inv.buyer?.address) y -= baris(inv.buyer.address, M, y, W * 0.6, { saiz: 9, warna: KELABU });
  if (inv.payer_name || inv.payer_email) {
    teks(tr("Up: {0}", [inv.payer_name, inv.payer_email].filter(Boolean).join(" · ")), M, y, { saiz: 9, warna: KELABU });
    y -= 12;
  }
  y -= 14;

  // Jadual item
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 20, color: rgb(0.96, 0.97, 0.97) });
  teks(tr("Perkara"), M + 8, y, { saiz: 9, b: true });
  teks(tr("Amaun"), M + W - 8, y, { saiz: 9, b: true, kanan: true });
  y -= 24;
  teks(tr("Langganan HRBoost 1 tahun"), M + 8, y, { saiz: 10 });
  teks(rmSen(inv.subtotal_sen), M + W - 8, y, { saiz: 10, kanan: true });
  y -= 13;
  teks(tr("Tempoh: {0} – {1} · Semua modul, pekerja tanpa had", tarikhPdf(inv.period_start), tarikhPdf(inv.period_end)), M + 8, y, { saiz: 8.5, warna: KELABU });
  y -= 18;
  if (inv.discount_sen > 0) {
    teks(tr("Diskaun{0}", inv.voucher_label ? ` (${inv.voucher_label})` : ""), M + 8, y, { saiz: 10 });
    teks("-" + rmSen(inv.discount_sen), M + W - 8, y, { saiz: 10, kanan: true });
    y -= 18;
  }
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: M + W, y: y + 6 }, thickness: 0.6, color: GARIS });
  y -= 10;
  teks(resit ? tr("Jumlah dibayar") : tr("Jumlah perlu dibayar"), M + W - 160, y, { saiz: 11, b: true, kanan: true });
  teks(rmSen(inv.total_sen), M + W - 8, y, { saiz: 13, b: true, warna: HIJAU, kanan: true });
  y -= 14;
  teks(tr("Tiada SST dikenakan."), M + W - 8, y, { saiz: 8, warna: KELABU, kanan: true });
  y -= 28;

  if (resit) {
    // Cop DIBAYAR
    page.drawRectangle({ x: M, y: y - 34, width: 150, height: 40, borderColor: HIJAU, borderWidth: 1.5 });
    teks(tr("DIBAYAR"), M + 75 - tebal.widthOfTextAtSize(tr("DIBAYAR"), 16) / 2, y - 16, { saiz: 16, b: true, warna: HIJAU });
    teks(tarikhPdf(inv.paid_at), M + 75 - biasa.widthOfTextAtSize(tarikhPdf(inv.paid_at), 8.5) / 2, y - 28, { saiz: 8.5, warna: HIJAU });
    let yy = y - 4;
    const info = [
      [tr("Kaedah bayaran"), inv.payment_method ? `CHIP · ${inv.payment_method.toUpperCase()}` : inv.total_sen > 0 ? "CHIP" : tr("Baucar")],
      [tr("ID transaksi"), inv.chip_purchase_id ?? "-"],
    ];
    for (const [k, v] of info) {
      teks(k, M + 170, yy, { saiz: 9, warna: KELABU });
      teks(v, M + 270, yy, { saiz: 9 });
      yy -= 13;
    }
    y -= 56;
  } else {
    y -= baris(tr("Bayar dalam talian melalui HRBoost → Tetapan → Langganan (FPX, kad atau e-dompet melalui CHIP). Invois ini dijana oleh komputer dan tidak memerlukan tandatangan."), M, y, W, { saiz: 9, warna: KELABU });
  }

  // Kaki
  teks(tr("Dokumen ini dijana oleh komputer. Tandatangan tidak diperlukan."), M + W / 2 - biasa.widthOfTextAtSize(tr("Dokumen ini dijana oleh komputer. Tandatangan tidak diperlukan."), 8) / 2, 40, { saiz: 8, warna: KELABU });
  return doc.save();
}

export async function simpanAtauKongsiBil(inv: Invois, jenis: "invois" | "resit", kongsi: boolean) {
  const nama = `${jenis === "resit" ? tr("Resit") : tr("Invois")}-${(jenis === "resit" ? inv.receipt_number : inv.number) ?? inv.id}.pdf`;
  return simpanAtauKongsiPdf(await janaBilPdf(inv, jenis), nama, kongsi);
}
