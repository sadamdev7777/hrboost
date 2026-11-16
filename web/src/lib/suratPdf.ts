"use client";

import { tr } from "@/lib/i18n";
import { urlLogo } from "@/lib/logo";
import { labelSurat, type DataSurat } from "@/lib/urusan";
import { binaSurat, suratSulit, tarikhSurat, teksKaki, type Blok, type Seg } from "@/lib/suratKandungan";
import { benamLogoHRBoost, lukisLogoHRBoost, simpanAtauKongsiPdf } from "@/lib/slipPdf";

// Surat sebagai fail PDF A4 sebenar, dijana dalam pelayar daripada blok yang sama dengan paparan skrin
// (lib/suratKandungan.ts). Data pekerja tidak dihantar ke mana-mana pelayan.

// Fon standard PDF hanya menyokong WinAnsi: aksara lain diganti
const selamat = (t: string) =>
  t
    .replace(/[•]/g, "*")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”·\n]/g, "?");

export function namaFailSurat(s: DataSurat) {
  const bersih = (x: string) => x.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${bersih(labelSurat(s.kind))}-${bersih(s.ref_no)}-${bersih(s.full_name).slice(0, 40)}.pdf`;
}

export async function janaSuratPdf(s: DataSurat): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  type Halaman = ReturnType<typeof doc.addPage>;
  const doc = await PDFDocument.create();
  doc.setTitle(`${labelSurat(s.kind)} ${s.ref_no}`);
  doc.setProducer("HRBoost.io");
  doc.setCreator("HRBoost.io");
  const biasa = await doc.embedFont(StandardFonts.TimesRoman);
  const tebal = await doc.embedFont(StandardFonts.TimesRomanBold);
  const HITAM = rgb(0, 0, 0);
  const KELABU = rgb(0.33, 0.33, 0.33);
  const LEBAR = 595.28;
  const TINGGI = 841.89;
  const M = 51; // ~18 mm
  const W = LEBAR - M * 2;
  const BAWAH = M + 30; // ruang kaki
  const SAIZ = 11;
  const BARIS = 15.5;

  let page: Halaman = doc.addPage([LEBAR, TINGGI]);
  let y = TINGGI - M;

  const halamanBaru = () => {
    page = doc.addPage([LEBAR, TINGGI]);
    y = TINGGI - M;
  };
  const perlu = (h: number) => {
    if (y - h < BAWAH) halamanBaru();
  };
  const lebarTeks = (t: string, b = false, saiz = SAIZ) => (b ? tebal : biasa).widthOfTextAtSize(selamat(t), saiz);
  const lukis = (t: string, x: number, yy: number, o: { b?: boolean; saiz?: number; warna?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(selamat(t), { x, y: yy, size: o.saiz ?? SAIZ, font: o.b ? tebal : biasa, color: o.warna ?? HITAM });
  const garis = (yy: number, x1 = M, x2 = M + W, t = 0.8, warna = HITAM, putus = false) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: t, color: warna, ...(putus ? { dashArray: [3, 3] } : {}) });

  /** Bungkus segmen (biasa / tebal) kepada baris mengikut lebar; "\n" = baris baharu */
  function bungkus(isi: Seg[], lebar: number, saiz = SAIZ): { t: string; b: boolean }[][] {
    const kata: { t: string; b: boolean; baru?: boolean }[] = [];
    for (const seg of isi) {
      const b = typeof seg !== "string";
      const teks = typeof seg === "string" ? seg : seg.b;
      teks.split(/(\n)/).forEach((bah) => {
        if (bah === "\n") kata.push({ t: "", b, baru: true });
        else bah.split(/(?<= )/).forEach((k) => k && kata.push({ t: k, b }));
      });
    }
    const baris: { t: string; b: boolean }[][] = [[]];
    let w = 0;
    for (const k of kata) {
      if (k.baru) {
        baris.push([]);
        w = 0;
        continue;
      }
      const kw = lebarTeks(k.t, k.b, saiz);
      if (w + kw > lebar && w > 0) {
        baris.push([]);
        w = 0;
        k.t = k.t.replace(/^ +/, "");
      }
      baris[baris.length - 1].push({ t: k.t, b: k.b });
      w += lebarTeks(k.t, k.b, saiz);
    }
    return baris;
  }
  function tulisSeg(isi: Seg[], x: number, lebar: number, o: { saiz?: number; kanan?: boolean; semuaTebal?: boolean } = {}) {
    const saiz = o.saiz ?? SAIZ;
    for (const b of bungkus(isi.map((s2) => (o.semuaTebal && typeof s2 === "string" ? { b: s2 } : s2)), lebar, saiz)) {
      perlu(BARIS);
      // Gabungkan perkataan berturut dengan gaya yang sama supaya jarak antara perkataan kekal dalam teks PDF
      const larian: { t: string; b: boolean }[] = [];
      for (const k of b) {
        const akhir = larian[larian.length - 1];
        if (akhir && akhir.b === k.b) akhir.t += k.t;
        else larian.push({ ...k });
      }
      let xx = o.kanan ? x + lebar - larian.reduce((a, k) => a + lebarTeks(k.t, k.b, saiz), 0) : x;
      for (const k of larian) {
        lukis(k.t, xx, y - saiz, { b: k.b, saiz });
        xx += lebarTeks(k.t, k.b, saiz);
      }
      y -= BARIS;
    }
  }

  // ---------------------------------------------------------------- kepala surat
  const logo = urlLogo(s.logo_path ?? null);
  if (logo) {
    try {
      const bait = new Uint8Array(await (await fetch(logo)).arrayBuffer());
      const png = bait[0] === 0x89 && bait[1] === 0x50;
      const img = png ? await doc.embedPng(bait) : await doc.embedJpg(bait);
      const sk = Math.min(180 / img.width, 46 / img.height);
      page.drawImage(img, { x: M + (W - img.width * sk) / 2, y: y - img.height * sk, width: img.width * sk, height: img.height * sk });
      y -= img.height * sk + 8;
    } catch {
      /* logo tidak dapat dimuatkan (cth. format WebP) — teruskan tanpa logo */
    }
  }
  const tengah = (t: string, o: { b?: boolean; saiz?: number }) => {
    const saiz = o.saiz ?? SAIZ;
    for (const b of bungkus([o.b ? { b: t } : t], W, saiz)) {
      const teks = b.map((k) => k.t).join("");
      lukis(teks, M + (W - lebarTeks(teks, o.b, saiz)) / 2, y - saiz, { b: o.b, saiz });
      y -= saiz + 4;
    }
  };
  tengah(s.company.name.toUpperCase(), { b: true, saiz: 14 });
  if (s.company.reg_no) tengah(`(${s.company.reg_no})`, { saiz: 9 });
  if (s.company.address) tengah(s.company.address, { saiz: 9 });
  y -= 4;
  garis(y, M, M + W, 1.6);
  y -= 18;

  if (s.kind === "salary_advance") {
    tengah(tr("MEMO DALAMAN"), { b: true, saiz: 12 });
    y -= 6;
  }
  const ruj = tr("Rujukan: {0}", s.ref_no);
  lukis(ruj, M, y - 10, { saiz: 10 });
  if (suratSulit(s)) lukis(tr("SULIT"), M + lebarTeks(ruj, false, 10) + 14, y - 10, { saiz: 10, b: true });
  const tkh = tr("Tarikh: {0}", tarikhSurat(s.issued_at.slice(0, 10)));
  lukis(tkh, M + W - lebarTeks(tkh, false, 10), y - 10, { saiz: 10 });
  y -= 30;

  // ---------------------------------------------------------------- badan surat
  const JARAK = 9;
  const lukisBlok = (b: Blok) => {
    switch (b.t) {
      case "penerima":
        tulisSeg([{ b: b.nama }], M, W);
        tulisSeg([b.ic], M, W);
        if (b.alamat) tulisSeg([b.alamat], M, W);
        break;
      case "p":
        tulisSeg(b.isi, M, W);
        break;
      case "tajuk": {
        const atas = b.teks.toUpperCase();
        for (const baris of bungkus([{ b: atas }], W)) {
          perlu(BARIS);
          const t = baris.map((k) => k.t).join("");
          lukis(t, M, y - SAIZ, { b: true });
          garis(y - SAIZ - 2, M, M + lebarTeks(t, true), 0.7);
          y -= BARIS;
        }
        break;
      }
      case "pusat":
        tengah(b.teks, { b: true, saiz: 12 });
        break;
      case "jadual": {
        const lk = b.kanan ? 250 : W * 0.42;
        const lv = b.kanan ? 110 : W - lk;
        for (const r of b.baris) {
          const nilai: Seg[] = b.kanan ? r.v : [": ", ...r.v];
          const tKiri = bungkus([r.tebal ? { b: r.k } : r.k], lk - 8);
          const tKanan = bungkus(nilai.map((x) => (r.tebal && typeof x === "string" ? { b: x } : x)), lv);
          const h = Math.max(tKiri.length, tKanan.length) * BARIS + 2;
          perlu(h);
          if (r.garis) garis(y + 1, M, M + lk + lv, 0.7);
          const y0 = y;
          tulisSeg([r.tebal ? { b: r.k } : r.k], M, lk - 8);
          const ySelepasKiri = y;
          y = y0;
          tulisSeg(nilai, M + lk, lv, { kanan: b.kanan, semuaTebal: r.tebal });
          y = Math.min(y, ySelepasKiri) - 2;
        }
        break;
      }
      case "senarai":
        b.item.forEach((x, i) => {
          const no = `${i + 1}. `;
          perlu(BARIS);
          lukis(no, M + 12, y - SAIZ);
          tulisSeg([x], M + 12 + lebarTeks(no), W - 12 - lebarTeks(no));
        });
        break;
      case "tandatangan":
        perlu(4 * BARIS + 36);
        y -= 36;
        garis(y, M, M + 170, 0.7);
        y -= 3;
        tulisSeg([{ b: b.nama }], M, W);
        tulisSeg([b.jawatan], M, W);
        tulisSeg([b.syarikat], M, W);
        break;
      case "akuan": {
        perlu(7 * BARIS + 40);
        y -= 8;
        garis(y, M, M + W, 0.7, HITAM, true);
        y -= 8;
        tulisSeg([{ b: tr("Akuan penerimaan").toUpperCase() }], M, W, { saiz: 10 });
        tulisSeg([b.teks], M, W);
        y -= 34;
        const separuh = (W - 24) / 2;
        garis(y, M, M + separuh, 0.7);
        garis(y, M + separuh + 24, M + W, 0.7);
        y -= 3;
        const y0 = y;
        tulisSeg([b.nama], M, separuh, { saiz: 10 });
        tulisSeg([b.ic], M, separuh, { saiz: 10 });
        const ya = y;
        y = y0;
        tulisSeg([tr("Tarikh")], M + separuh + 24, separuh, { saiz: 10 });
        y = Math.min(y, ya);
        break;
      }
    }
    y -= JARAK;
  };
  for (const b of binaSurat(s)) lukisBlok(b);

  // ---------------------------------------------------------------- kaki setiap halaman
  const halaman = doc.getPages();
  const kaki = teksKaki(s);
  const jenama = await benamLogoHRBoost(doc);
  halaman.forEach((hp, i) => {
    page = hp;
    if (jenama) lukisLogoHRBoost(hp, jenama);
    garis(M + 22, M, M + W, 0.5, rgb(0.8, 0.8, 0.8));
    const baris = bungkus([kaki], W - 70, 7.5);
    let yy = M + 12;
    for (const b of baris) {
      const t = b.map((k) => k.t).join("");
      lukis(t, M + (W - 70 - lebarTeks(t, false, 7.5)) / 2, yy, { saiz: 7.5, warna: KELABU });
      yy -= 9;
    }
    const no = tr("Halaman {0} / {1}", i + 1, halaman.length);
    lukis(no, M + W - lebarTeks(no, false, 7.5), M + 12, { saiz: 7.5, warna: KELABU });
  });
  return doc.save();
}

/** Muat turun PDF surat, atau kongsi terus (cth. ke WhatsApp) jika pelayar menyokong perkongsian fail. */
export async function simpanAtauKongsiSurat(s: DataSurat, kongsi: boolean) {
  return simpanAtauKongsiPdf(await janaSuratPdf(s), namaFailSurat(s), kongsi);
}
