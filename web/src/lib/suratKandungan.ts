// Kandungan surat sebagai blok — dikongsi oleh paparan skrin (/surat/[id]) dan PDF (suratPdf.ts),
// supaya kedua-duanya sentiasa sama. Teks dalam bahasa pengguna melalui tr().
import { tr } from "@/lib/i18n";
import { labelJenis } from "@/lib/hr";
import type { DataSurat } from "@/lib/urusan";

/** Segmen teks: rentetan biasa atau { b } untuk teks tebal */
export type Seg = string | { b: string };
export type BarisJadual = { k: string; v: Seg[]; tebal?: boolean; garis?: boolean };
export type Blok =
  | { t: "penerima"; nama: string; ic: string; alamat: string | null }
  | { t: "p"; isi: Seg[] }
  | { t: "tajuk"; teks: string }
  | { t: "pusat"; teks: string }
  | { t: "jadual"; baris: BarisJadual[]; kanan?: boolean }
  | { t: "senarai"; item: string[] }
  | { t: "tandatangan"; nama: string; jawatan: string; syarikat: string }
  | { t: "akuan"; teks: string; nama: string; ic: string };

const BULAN = [tr("Januari"), tr("Februari"), tr("Mac"), tr("April"), tr("Mei"), tr("Jun"), tr("Julai"), tr("Ogos"), tr("September"), tr("Oktober"), tr("November"), tr("Disember")];
const HARI = [tr("Ahad"), tr("Isnin"), tr("Selasa"), tr("Rabu"), tr("Khamis"), tr("Jumaat"), tr("Sabtu")];
export const tarikhSurat = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "-");
const rm = (n: number) => tr("RM {0}", n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const formatIc = (s: string | null) => (s && /^\d{12}$/.test(s) ? `${s.slice(0, 6)}-${s.slice(6, 8)}-${s.slice(8)}` : (s ?? "-"));
const PERINGKAT_AMARAN = (): Record<string, string> => ({ "1": tr("pertama"), "2": tr("kedua"), "3": tr("terakhir") });

/** Surat yang ditanda SULIT */
export const suratSulit = (s: DataSurat) => ["salary_increment", "warning", "show_cause", "salary_advance"].includes(s.kind);
export const teksKaki = (s: DataSurat) =>
  tr("Surat ini dijana melalui HRBoost.io. Pengesahan boleh dibuat dengan menghubungi HR {0} dengan menyebut rujukan {1}.", s.company.name, s.ref_no);

/** Waktu bekerja daripada jadual syarikat, cth. "Isnin – Jumaat 08:00 – 16:30; Sabtu 08:00 – 12:30" */
function waktuKerja(s: DataSurat): string {
  if (s.details?.work_hours) return s.details.work_hours;
  const j = s.work_schedule;
  if (j && Object.keys(j).length) {
    const kumpulan: { hari: number[]; masa: string }[] = [];
    for (const h of [1, 2, 3, 4, 5, 6, 0]) {
      const x = j[String(h)];
      if (!x) continue;
      const masa = `${x.start} – ${x.end}`;
      const akhir = kumpulan[kumpulan.length - 1];
      if (akhir && akhir.masa === masa && (akhir.hari[akhir.hari.length - 1] + 1) % 7 === h) akhir.hari.push(h);
      else kumpulan.push({ hari: [h], masa });
    }
    return kumpulan.map((k) => `${k.hari.length > 1 ? `${HARI[k.hari[0]]} – ${HARI[k.hari[k.hari.length - 1]]}` : HARI[k.hari[0]]} ${k.masa}`).join("; ");
  }
  if (s.work_start && s.work_end) {
    const rehat = new Set(s.weekend_days ?? [0, 6]);
    const hari = [1, 2, 3, 4, 5, 6, 0].filter((h) => !rehat.has(h));
    const julat = hari.length ? `${HARI[hari[0]]} – ${HARI[hari[hari.length - 1]]}` : "";
    return `${julat} ${s.work_start} – ${s.work_end}`.trim();
  }
  return "-";
}

const p = (...isi: Seg[]): Blok => ({ t: "p", isi });
const baris = (k: string, v: Seg | Seg[], tebal?: boolean): BarisJadual => ({ k, v: Array.isArray(v) ? v : [v], tebal });

/** Bina kandungan surat (selepas kepala, rujukan & tarikh) */
export function binaSurat(s: DataSurat): Blok[] {
  const d = s.details ?? {};
  const jawatan = s.position ?? tr("pekerja");
  const jabatan = s.department ? tr(" di Jabatan {0}", s.department) : "";
  const penerima: Blok = { t: "penerima", nama: s.full_name, ic: tr("No. kad pengenalan: {0}", formatIc(s.ic_no)), alamat: s.address ?? null };
  const tt: Blok = {
    t: "tandatangan",
    nama: s.signatory?.name ?? tr("Pengurus Sumber Manusia"),
    jawatan: s.signatory?.position ?? tr("Pengurus Sumber Manusia"),
    syarikat: s.company.name,
  };
  const akuan = (teks: string): Blok => ({ t: "akuan", teks, nama: s.full_name, ic: tr("No. kad pengenalan: {0}", formatIc(s.ic_no)) });
  const tuan = p(tr("Tuan/Puan,"));
  const sekian = p(tr("Sekian, terima kasih."));
  const nota = (x?: string): Blok[] => (x ? [p(x)] : []);

  switch (s.kind) {
    case "offer":
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: s.position ? tr("Tawaran pekerjaan sebagai {0}", s.position) : tr("Tawaran pekerjaan") },
        p(
          s.position
            ? tr("Dengan sukacitanya kami menawarkan kepada tuan/puan jawatan {0}{1}, {2}, tertakluk kepada terma dan syarat berikut:", s.position, jabatan, s.company.name)
            : tr("Dengan sukacitanya kami menawarkan pekerjaan kepada tuan/puan{0}, {1}, tertakluk kepada terma dan syarat berikut:", jabatan, s.company.name),
        ),
        {
          t: "jadual",
          baris: [
            ...(s.position ? [baris(tr("Jawatan"), s.position)] : []),
            ...(s.department ? [baris(tr("Jabatan"), s.department)] : []),
            baris(tr("Jenis pekerjaan"), labelJenis(s.employment_type)),
            baris(tr("Tarikh mula bertugas"), tarikhSurat(s.join_date)),
            ...(s.probation_end_date ? [baris(tr("Tempoh percubaan"), tr("Sehingga {0}", tarikhSurat(s.probation_end_date)))] : []),
            baris(tr("Gaji pokok bulanan"), rm(Number(s.basic ?? 0))),
            ...(Number(s.allowances ?? 0) > 0 ? [baris(tr("Elaun tetap bulanan"), rm(Number(s.allowances)))] : []),
            baris(tr("Waktu bekerja"), waktuKerja(s)),
            ...(s.leave?.AL != null ? [baris(tr("Cuti tahunan"), tr("{0} hari setahun", s.leave.AL))] : []),
            ...(s.leave?.MC != null ? [baris(tr("Cuti sakit"), tr("{0} hari setahun", s.leave.MC))] : []),
            baris(tr("Caruman berkanun"), tr("KWSP, PERKESO dan SIP mengikut kadar semasa")),
          ],
        },
        ...nota(d.note),
        p(
          tr(
            "Terma perkhidmatan lain adalah tertakluk kepada Akta Kerja 1955 dan buku panduan pekerja syarikat. Sila tandatangani akuan di bawah sebagai tanda penerimaan dan kembalikan kepada kami selewat-lewatnya pada {0}. Tawaran ini terbatal sekiranya tidak diterima sebelum tarikh tersebut.",
            tarikhSurat(d.accept_by),
          ),
        ),
        p(tr("Kami mengalu-alukan tuan/puan menyertai {0}.", s.company.name)),
        sekian,
        tt,
        akuan(tr("Saya menerima tawaran pekerjaan di atas mengikut terma dan syarat yang dinyatakan.")),
      ];
    case "confirmation":
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Pengesahan dalam jawatan") },
        p(tr("Sukacita dimaklumkan bahawa pihak pengurusan telah meluluskan pengesahan tuan/puan dalam jawatan {0}{1} berkuat kuasa {2}, setelah menamatkan tempoh percubaan dengan memuaskan.", jawatan, jabatan, tarikhSurat(d.effective_date))),
        ...(s.basic != null ? [p(tr("Gaji pokok bulanan tuan/puan ialah {0}. Terma dan syarat perkhidmatan yang lain kekal seperti dalam surat tawaran.", rm(Number(s.basic))))] : []),
        ...nota(d.note),
        p(tr("Tahniah, dan terima kasih atas sumbangan tuan/puan kepada syarikat.")),
        sekian,
        tt,
      ];
    case "probation_extension":
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Lanjutan tempoh percubaan") },
        p(tr("Dimaklumkan bahawa tempoh percubaan tuan/puan sebagai {0}{1}, yang sepatutnya tamat pada {2}, dilanjutkan sehingga {3}.", jawatan, jabatan, tarikhSurat(d.old_end_date), tarikhSurat(d.new_end_date))),
        p(tr("Lanjutan ini diberikan bagi membolehkan tuan/puan memperbaiki perkara berikut:")),
        ...nota(d.improve),
        p(tr("Prestasi tuan/puan akan dinilai semula sebelum tarikh tersebut. Sila berbincang dengan ketua jabatan sekiranya memerlukan sebarang sokongan.")),
        sekian,
        tt,
      ];
    case "resignation_accept":
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Penerimaan peletakan jawatan") },
        p(tr("Kami merujuk kepada notis peletakan jawatan tuan/puan bertarikh {0}. Pihak syarikat menerima peletakan jawatan tuan/puan sebagai {1}{2}, dan hari bekerja terakhir tuan/puan ialah {3}.", tarikhSurat(d.notice_date), jawatan, jabatan, tarikhSurat(s.end_date))),
        ...((s.assets ?? []).length > 0
          ? [
              p(tr("Sila pulangkan item syarikat berikut sebelum atau pada hari bekerja terakhir:")),
              { t: "senarai", item: (s.assets ?? []).map((a) => a.name + (a.serial_no ? tr(" (No. siri: {0})", a.serial_no) : "")) } as Blok,
            ]
          : [p(tr("Rekod kami menunjukkan tiada item syarikat yang belum dipulangkan oleh tuan/puan."))]),
        ...nota(d.note),
        p(tr("Gaji dan bayaran akhir akan dibuat mengikut kitaran gaji biasa selepas semua urusan penyerahan tugas dan item syarikat selesai.")),
        p(tr("Kami mengucapkan terima kasih atas perkhidmatan tuan/puan bersama {0} dan mendoakan kejayaan tuan/puan pada masa hadapan.", s.company.name)),
        sekian,
        tt,
      ];
    case "experience":
      return [
        p(tr("Kepada sesiapa yang berkenaan,")),
        { t: "tajuk", teks: tr("Surat pengalaman kerja: {0}", s.full_name) },
        p(tr("Dengan ini disahkan bahawa {0} (No. kad pengenalan: {1}) telah berkhidmat dengan {2} dari {3} hingga {4}. Jawatan terakhir yang disandang ialah {5}{6}.", s.full_name, formatIc(s.ic_no), s.company.name, tarikhSurat(s.join_date), tarikhSurat(s.end_date), jawatan, jabatan)),
        ...nota(d.note),
        p(tr("Kami mengucapkan terima kasih atas sumbangan beliau dan mendoakan kejayaan beliau pada masa hadapan.")),
        sekian,
        tt,
      ];
    case "salary_increment": {
      const lama = Number(s.old_basic ?? 0);
      const baru = Number(s.new_basic ?? 0);
      const naik = baru - lama;
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Kenaikan gaji") },
        p(tr("Sukacita dimaklumkan bahawa pihak pengurusan telah meluluskan kenaikan gaji pokok tuan/puan berkuat kuasa {0}.", tarikhSurat(s.increment_from))),
        {
          t: "jadual",
          baris: [
            baris(tr("Gaji pokok lama"), rm(lama)),
            baris(tr("Gaji pokok baharu"), { b: rm(baru) }),
            baris(tr("Kenaikan"), lama > 0 ? `${rm(naik)} (${((naik / lama) * 100).toFixed(1)}%)` : rm(naik)),
            ...(d.reason ? [baris(tr("Sebab"), d.reason)] : []),
          ],
        },
        p(tr("Terma dan syarat perkhidmatan yang lain kekal tidak berubah. Maklumat gaji ini adalah sulit.")),
        p(tr("Tahniah, dan terima kasih atas sumbangan tuan/puan.")),
        sekian,
        tt,
      ];
    }
    case "warning": {
      const peringkat = PERINGKAT_AMARAN()[d.warning_no ?? "1"] ?? "";
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Surat amaran {0}", peringkat) },
        p(tr("Pihak pengurusan merujuk kepada perkara yang berlaku pada {0} seperti berikut:", tarikhSurat(d.incident_date))),
        ...nota(d.description),
        p(d.rule ? tr("Perbuatan ini bertentangan dengan {0}.", d.rule) : tr("Perbuatan ini bertentangan dengan peraturan dan tatakelakuan syarikat.")),
        p(
          tr(
            "Dengan ini tuan/puan diberi amaran {0} dan diingatkan supaya tidak mengulangi perbuatan tersebut. Kegagalan mematuhi peraturan syarikat boleh mengakibatkan tindakan tatatertib yang lebih berat, termasuk penamatan perkhidmatan, setelah siasatan wajar dijalankan.",
            peringkat,
          ),
        ),
        p(tr("Salinan surat ini disimpan dalam fail peribadi tuan/puan.")),
        sekian,
        tt,
        akuan(tr("Saya mengaku telah menerima dan memahami kandungan surat ini.")),
      ];
    }
    case "show_cause":
      return [
        penerima,
        tuan,
        { t: "tajuk", teks: tr("Surat tunjuk sebab") },
        p(tr("Pihak pengurusan mendapati perkara berikut yang berlaku pada {0}:", tarikhSurat(d.incident_date))),
        ...nota(d.description),
        p(
          tr(
            "Sehubungan itu, tuan/puan dikehendaki memberikan penjelasan bertulis mengapa tindakan tatatertib tidak patut diambil terhadap tuan/puan. Penjelasan hendaklah diserahkan kepada HR selewat-lewatnya pada {0}.",
            tarikhSurat(d.reply_by),
          ),
        ),
        p(tr("Sekiranya tiada penjelasan diterima dalam tempoh tersebut, pihak pengurusan akan membuat keputusan berdasarkan maklumat yang ada.")),
        sekian,
        tt,
        akuan(tr("Saya mengaku telah menerima surat ini.")),
      ];
    case "salary_advance": {
      const a = s.advance;
      return [
        {
          t: "jadual",
          baris: [
            baris(tr("Kepada"), tr("Jabatan Kewangan")),
            baris(tr("Daripada"), `${s.signatory?.name ?? ""}, ${s.signatory?.position ?? tr("Sumber Manusia")}`),
            baris(tr("Perkara"), { b: tr("Pendahuluan gaji: {0} ({1})", s.full_name, s.employee_no) }),
          ],
        },
        p(tr("Untuk rekod dan tindakan pihak Kewangan, pendahuluan gaji berikut telah diluluskan:")),
        ...(a
          ? [
              {
                t: "jadual",
                baris: [
                  baris(tr("Nama pekerja"), s.full_name),
                  baris(tr("No. pekerja"), s.employee_no),
                  ...(s.department ? [baris(tr("Jabatan"), s.department)] : []),
                  baris(tr("Jumlah diluluskan"), { b: rm(Number(a.amount)) }),
                  baris(tr("Sebab"), a.reason),
                  baris(tr("Tarikh permohonan"), tarikhSurat(a.requested_at?.slice(0, 10))),
                  baris(tr("Diluluskan oleh"), a.approvers.length ? a.approvers.map((x) => `${x.name}${x.at ? ` (${tarikhSurat(x.at.slice(0, 10))})` : ""}`).join(", ") : "-"),
                  baris(tr("Potongan gaji"), a.deduct_month ? `${BULAN[a.deduct_month - 1]} ${a.deduct_year}` : "-"),
                  baris(tr("Status bayaran"), a.disbursed_at ? tr("Dibayar pada {0}", tarikhSurat(a.disbursed_at.slice(0, 10))) : tr("Belum dibayar")),
                  ...(a.bank ? [baris(tr("Bank pekerja"), a.bank)] : []),
                ],
              } as Blok,
            ]
          : []),
        ...nota(d.note),
        p(tr("Jumlah ini ditolak secara automatik daripada gaji pekerja semasa Proses Gaji bagi bulan potongan di atas.")),
        tt,
      ];
    }
    default: {
      // Surat atas permintaan pekerja: pengesahan majikan / gaji
      const tetap = s.employment_type === "permanent";
      const isi: Seg[] = [
        tr("Dengan hormatnya perkara di atas adalah dirujuk. Kami dengan ini mengesahkan bahawa") + " ",
        { b: s.full_name },
        " " + tr("(No. kad pengenalan: {0}) adalah pekerja {1} {2} sejak {3}", formatIc(s.ic_no), tetap ? tr("tetap") : labelJenis(s.employment_type).toLowerCase(), s.company.name, tarikhSurat(s.join_date)),
        ...(s.position ? [tr(", dan kini memegang jawatan sebagai") + " ", { b: s.position }, s.department ? tr(" di Jabatan {0}", s.department) : ""] : s.department ? [tr(", di Jabatan {0}", s.department)] : []),
        ".",
      ];
      return [
        p(s.addressed_to ? `${tr("Kepada:")}\n${s.addressed_to}` : tr("Kepada sesiapa yang berkenaan,")),
        { t: "tajuk", teks: `${s.kind === "salary" ? tr("Pengesahan jawatan dan gaji") : tr("Pengesahan majikan")}: ${s.full_name}` },
        { t: "p", isi },
        ...(s.kind === "salary" && s.basic != null
          ? [
              {
                t: "jadual",
                kanan: true,
                baris: [
                  baris(tr("Gaji pokok bulanan"), rm(Number(s.basic))),
                  baris(tr("Elaun tetap bulanan"), rm(Number(s.allowances ?? 0))),
                  { k: tr("Jumlah pendapatan tetap bulanan"), v: [rm(Number(s.basic) + Number(s.allowances ?? 0))], tebal: true, garis: true },
                ],
              } as Blok,
            ]
          : []),
        p(tr("Surat ini dikeluarkan atas permintaan pekerja tersebut bagi tujuan {0} dan tidak boleh digunakan untuk tujuan lain.", s.purpose.toLowerCase())),
        sekian,
        tt,
      ];
    }
  }
}
