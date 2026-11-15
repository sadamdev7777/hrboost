// Tetapan laman utama awam.

/**
 * Ciri yang belum wujud disembunyikan secara lalai. Hidupkan dengan pemboleh ubah persekitaran
 * apabila ciri itu siap (NEXT_PUBLIC_DEMO=1, NEXT_PUBLIC_ALAT_PERCUMA=1).
 */
export const BENDERA = {
  /** Syarikat demo tanpa daftar (seksyen "Cuba dahulu", butang "Cuba demo") */
  demo: process.env.NEXT_PUBLIC_DEMO === "1",
  /** Alat HR percuma tanpa log masuk (seksyen & kumpulan pautan kaki halaman) */
  alatPercuma: process.env.NEXT_PUBLIC_ALAT_PERCUMA === "1",
};

/** Anggaran harga sistem HR & gaji lain (RM seorang sebulan), berdasarkan harga umum yang diterbitkan. */
export const KADAR_SISTEM_LAIN = { min: 8, maks: 17 };

/** Kalkulator penjimatan: julat bilangan pekerja */
export const KALKULATOR = { min: 5, maks: 50, langkah: 5, lalai: 20 };

export const HUBUNGI = { whatsapp: "019-444 2424", waUrl: "https://wa.me/60194442424", emel: "hi@hrboost.io" };
