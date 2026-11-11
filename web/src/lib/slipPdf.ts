"use client";

import { tr } from "@/lib/i18n";
import type { Slip } from "@/lib/gaji";
import { BULAN_PENUH, BULAN_RINGKAS } from "@/lib/gaji";
import { tarikh } from "@/lib/format";
import { urlLogo } from "@/lib/logo";

// Slip gaji sebagai fail PDF A4 sebenar, dijana dalam pelayar (data gaji tidak dihantar ke mana-mana pelayan).
// Susun atur mengikut components/SlipGaji.tsx (rujukan reka bentuk: design/SlipGaji.dc.html).

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sorokIC = (ic: string | null) => (ic ? `******-**-${ic.replace(/\D/g, "").slice(-4)}` : "-");
// Fon standard PDF hanya menyokong WinAnsi: aksara lain (cth. tulisan Cina) diganti "?"
const selamat = (t: string) => t.replace(/[•]/g, "*").replace(/[^\x20-\x7E -ÿ–—‘’“”·]/g, "?");

const LABEL_POTONGAN: Record<string, string> = {
  EPF: tr("KWSP (pekerja)"),
  SOCSO: tr("PERKESO (pekerja)"),
  EIS: tr("SIP / EIS (pekerja)"),
  SKBBK: tr("Lindung 24 Jam (SKBBK)"),
  PCB: tr("PCB / MTD"),
  CP38: tr("CP38 (arahan LHDN)"),
  ZAKAT: tr("Zakat"),
  UNPAID: tr("Cuti tanpa gaji"),
};
const LABEL_MAJIKAN: Record<string, string> = { EPF_ER: tr("KWSP"), SOCSO_ER: tr("PERKESO"), EIS_ER: tr("SIP / EIS"), HRDF: "HRDF" };

export function namaFailSlip(s: Slip) {
  const nama = s.employee.fullName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${tr("Slip-Gaji")}-${s.year}-${String(s.month).padStart(2, "0")}${s.label ? "-" + s.label.replace(/[^A-Za-z0-9]+/g, "-") : ""}-${nama}.pdf`;
}

export async function janaSlipPdf(s: Slip): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`${tr("Slip gaji")} ${BULAN_PENUH[s.month - 1]} ${s.year}`);
  doc.setProducer("HRBoost.io");
  doc.setCreator("HRBoost.io");
  const page = doc.addPage([595.28, 841.89]); // A4
  const biasa = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const HIJAU = rgb(15 / 255, 107 / 255, 95 / 255);
  const DAKWAT = rgb(20 / 255, 33 / 255, 31 / 255);
  const KELABU = rgb(91 / 255, 107 / 255, 104 / 255);
  const GARIS = rgb(0.9, 0.93, 0.92);
  const M = 40;
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  const teks = (t: string, x: number, yy: number, o: { saiz?: number; b?: boolean; warna?: ReturnType<typeof rgb>; kanan?: boolean; maks?: number } = {}) => {
    const f = o.b ? tebal : biasa;
    const saiz = o.saiz ?? 9;
    let s2 = selamat(t);
    if (o.maks && f.widthOfTextAtSize(s2, saiz) > o.maks) {
      while (s2.length > 3 && f.widthOfTextAtSize(s2 + "...", saiz) > o.maks) s2 = s2.slice(0, -1);
      s2 += "...";
    }
    const w = f.widthOfTextAtSize(s2, saiz);
    page.drawText(s2, { x: o.kanan ? x - w : x, y: yy, size: saiz, font: f, color: o.warna ?? DAKWAT });
  };
  const garis = (yy: number, x1 = M, x2 = M + W, tebalGaris = 0.6, warna = GARIS) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: tebalGaris, color: warna });

  // ---------------------------------------------------------------- Kepala
  const logo = urlLogo(s.company.logo_path);
  let tinggiLogo = 0;
  if (logo) {
    try {
      const bait = new Uint8Array(await (await fetch(logo)).arrayBuffer());
      const png = bait[0] === 0x89 && bait[1] === 0x50;
      const img = png ? await doc.embedPng(bait) : await doc.embedJpg(bait);
      const sk = Math.min(140 / img.width, 34 / img.height);
      page.drawImage(img, { x: M, y: y - img.height * sk, width: img.width * sk, height: img.height * sk });
      tinggiLogo = img.height * sk + 6;
    } catch {
      /* logo tidak dapat dimuatkan (cth. format WebP) — teruskan tanpa logo */
    }
  }
  let yk = y - tinggiLogo - 12;
  teks(s.company.name.toUpperCase(), M, yk, { saiz: 12, b: true, maks: W * 0.62 });
  if (s.company.reg_no) teks(tr("No. Syarikat {0}", s.company.reg_no), M, (yk -= 12), { warna: KELABU, saiz: 8 });
  teks(tr("No. Majikan KWSP {0} · PERKESO {1} · LHDN {2}", s.company.epf ?? "-", s.company.socso ?? "-", s.company.lhdn ?? "-"), M, (yk -= 11), { warna: KELABU, saiz: 8, maks: W * 0.62 });

  let yr = y - 12;
  teks(tr("SLIP GAJI"), M + W, yr, { saiz: 13, b: true, warna: HIJAU, kanan: true });
  teks(`${BULAN_PENUH[s.month - 1]} ${s.year}`, M + W, (yr -= 14), { b: true, kanan: true, saiz: 10 });
  if (s.label) teks(s.label, M + W, (yr -= 12), { b: true, kanan: true, warna: HIJAU });
  if (s.payDate) teks(tr("Dibayar {0} {1}", tarikh(s.payDate), s.payDate.slice(0, 4)), M + W, (yr -= 12), { kanan: true, warna: KELABU, saiz: 8 });
  y = Math.min(yk, yr) - 10;
  garis(y, M, M + W, 1.6, HIJAU);
  y -= 16;

  // ---------------------------------------------------------------- Maklumat pekerja (2 lajur)
  const info: [string, string][] = [
    [tr("Nama"), s.employee.fullName],
    [tr("No. pekerja"), s.employee.employeeNo],
    [tr("No. kad pengenalan"), sorokIC(s.employee.ic)],
    [tr("Jabatan"), s.employee.department ?? "-"],
    [tr("Jawatan"), s.employee.position ?? "-"],
    [tr("No. KWSP"), s.employee.epfNo ?? "-"],
    [tr("No. cukai"), s.employee.taxNo ?? "-"],
    [tr("No. PERKESO"), s.employee.socsoNo ?? "-"],
    [tr("Bank"), s.employee.bank ? `${s.employee.bank} ****${(s.employee.account ?? "").slice(-4)}` : "-"],
    [tr("Cuti tanpa gaji"), tr("{0} hari", s.unpaidDays)],
  ];
  const lajurW = (W - 24) / 2;
  for (let i = 0; i < info.length; i += 2) {
    for (let j = 0; j < 2; j++) {
      const r = info[i + j];
      if (!r) continue;
      const x = M + j * (lajurW + 24);
      teks(r[0], x, y, { warna: KELABU });
      teks(r[1], x + lajurW, y, { b: true, kanan: true, maks: lajurW - 90 });
      garis(y - 5, x, x + lajurW);
    }
    y -= 17;
  }
  y -= 8;

  // ---------------------------------------------------------------- Jadual
  const jadual = (x: number, yy: number, w: number, tajuk: string, baris: [string, string][], jumlah?: [string, string], kanan = "RM") => {
    teks(tajuk, x, yy, { b: true, saiz: 8, warna: KELABU, maks: w - 40 });
    teks(kanan, x + w, yy, { b: true, saiz: 8, warna: KELABU, kanan: true });
    garis(yy - 5, x, x + w, 0.8, DAKWAT);
    yy -= 17;
    for (const [k, v] of baris) {
      teks(k, x, yy, { maks: w - 70 });
      teks(v, x + w, yy, { kanan: true });
      garis(yy - 5, x, x + w);
      yy -= 15;
    }
    if (jumlah) {
      teks(jumlah[0], x, yy - 2, { b: true });
      teks(jumlah[1], x + w, yy - 2, { b: true, kanan: true });
      yy -= 17;
    }
    return yy;
  };

  const earn = s.lines.filter((l) => l.kind === "earning");
  const ded = s.lines.filter((l) => l.kind === "deduction");
  const er = s.lines.filter((l) => l.kind === "employer");
  const bik = s.lines.filter((l) => l.kind === "benefit");
  const jEarn = earn.reduce((a, l) => a + l.amount, 0);
  const jDed = ded.reduce((a, l) => a + l.amount, 0);
  const y1 = jadual(M, y, lajurW, tr("PENDAPATAN"), earn.map((l) => [l.description + (l.code === "CLAIM" ? " *" : ""), rm(l.amount)]), [tr("Jumlah pendapatan"), rm(jEarn)]);
  const y2 = jadual(M + lajurW + 24, y, lajurW, tr("POTONGAN"), ded.map((l) => [LABEL_POTONGAN[l.code] ?? l.description, rm(l.amount)]), [tr("Jumlah potongan"), rm(jDed)]);
  y = Math.min(y1, y2) - 8;

  // ---------------------------------------------------------------- Gaji bersih
  page.drawRectangle({ x: M, y: y - 30, width: W, height: 38, color: rgb(227 / 255, 241 / 255, 238 / 255) });
  teks(tr("GAJI BERSIH"), M + 14, y - 15, { b: true, warna: HIJAU, saiz: 10 });
  teks(tr("RM {0}", rm(s.net)), M + W - 14, y - 17, { b: true, warna: HIJAU, saiz: 17, kanan: true });
  y -= 52;

  if (bik.length) {
    y = jadual(M, y, W, tr("MANFAAT BERUPA BARANGAN (BIK) — BERCUKAI, TIDAK DIBAYAR TUNAI"), bik.map((l) => [l.description, rm(l.amount)])) - 8;
  }

  const kanan: { tajuk: string; baris: [string, string][]; k?: string }[] = [];
  if (s.options.ytd)
    kanan.push({
      tajuk: tr("TERKUMPUL {0} ({1}–{2})", s.year, BULAN_RINGKAS[0].toUpperCase(), BULAN_RINGKAS[s.month - 1].toUpperCase()),
      baris: [
        [tr("Pendapatan kasar"), rm(s.ytd.gross)],
        [tr("KWSP pekerja"), rm(s.ytd.epf)],
        ["PCB", rm(s.ytd.pcb)],
      ],
    });
  if (s.options.leave_summary && s.cuti.length) kanan.push({ tajuk: tr("BAKI CUTI (HARI)"), baris: s.cuti.map((c) => [c.name, String(c.available)]), k: tr("Hari") });
  const y3 = jadual(M, y, lajurW, tr("CARUMAN MAJIKAN"), er.map((l) => [LABEL_MAJIKAN[l.code] ?? l.description, rm(l.amount)]));
  let y4 = y;
  for (const b of kanan) y4 = jadual(M + lajurW + 24, y4, lajurW, b.tajuk, b.baris, undefined, b.k) - 8;
  y = Math.min(y3, y4) - 6;

  // ---------------------------------------------------------------- Kaki
  y = Math.min(y, 110);
  garis(y, M, M + W);
  y -= 13;
  const rujukan = `${s.company.code}-${s.year}${String(s.month).padStart(2, "0")}-${s.employee.employeeNo.replace(/\D/g, "").slice(-4)}`;
  if (s.lines.some((l) => l.code === "CLAIM")) {
    teks(tr("* Bayaran balik tuntutan tidak dikenakan KWSP, PERKESO atau cukai."), M, y, { saiz: 7.5, warna: KELABU });
    y -= 11;
  }
  if (s.lines.some((l) => l.code === "ARREARS")) {
    teks(tr("Tunggakan gaji: perbezaan gaji bagi bulan terdahulu akibat kenaikan gaji berkuat kuasa ke belakang."), M, y, { saiz: 7.5, warna: KELABU, maks: W });
    y -= 11;
  }
  teks(s.options.disclaimer || tr("Slip ini dijana oleh komputer. Tandatangan tidak diperlukan."), M, y, { saiz: 7.5, warna: KELABU, maks: W });
  y -= 11;
  teks(tr("Sulit — untuk penerima sahaja."), M, y, { saiz: 7.5, b: true, warna: KELABU });
  teks(tr("Rujukan slip {0}", rujukan), M + W, y, { saiz: 7.5, warna: KELABU, kanan: true });

  return doc.save();
}

/** Muat turun PDF, atau kongsi terus (cth. ke WhatsApp) jika pelayar menyokong perkongsian fail. */
export async function simpanAtauKongsiSlip(s: Slip, kongsi: boolean): Promise<"dikongsi" | "dimuat-turun" | "dibatalkan"> {
  const bait = await janaSlipPdf(s);
  const nama = namaFailSlip(s);
  const fail = new File([bait as BlobPart], nama, { type: "application/pdf" });
  if (kongsi && typeof navigator !== "undefined" && navigator.canShare?.({ files: [fail] })) {
    try {
      await navigator.share({ files: [fail], title: nama });
      return "dikongsi";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "dibatalkan";
    }
  }
  const url = URL.createObjectURL(fail);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "dimuat-turun";
}

export function bolehKongsiFail(): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "a.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}
