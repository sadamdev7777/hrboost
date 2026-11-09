import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Notis Privasi & Terma · HRBoost.io",
};

// Rujukan reka bentuk: design/Privasi.dc.html — DRAF, perlu semakan peguam (CLAUDE.md §6, §8).
export default function PrivasiPage() {
  return (
    <div className="min-h-dvh w-full bg-page text-ink">
      <nav className="border-b border-line-soft bg-surface">
        <div className="mx-auto flex max-w-[760px] items-center gap-2.5 px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-ink!">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-[13px] font-extrabold text-white">
              HR
            </span>
            <b className="text-[17px]">
              HRBoost<span className="text-primary">.io</span>
            </b>
          </Link>
          <a href="#privasi" className="ml-auto text-sm font-bold">
            Privasi
          </a>
          <a href="#terma" className="text-sm font-bold">
            Terma
          </a>
        </div>
      </nav>

      <article className="mx-auto max-w-[760px] px-6 pt-10 pb-[72px]">
        <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-bold text-[#6B3A0B]">
          DRAF — perlu disemak oleh peguam sebelum dilancarkan.
        </div>

        <h1 id="privasi" className="mt-7 mb-2 text-[32px] leading-[1.15] font-extrabold">
          Notis Privasi
        </h1>
        <P className="text-sm text-subtle">Kemas kini terakhir: [tarikh]</P>

        <H2>1. Siapa kami dan peranan kami</H2>
        <P>
          HRBoost.io menyediakan sistem HR kepada syarikat. Syarikat yang menggaji anda (majikan) ialah pihak yang
          mengawal data peribadi anda. HRBoost memproses data itu bagi pihak majikan anda, mengikut arahan mereka.
        </P>

        <H2>2. Data yang kami proses</H2>
        <Ul>
          <li>Maklumat pengenalan: nama penuh, nama panggilan, no. kad pengenalan, gambar profil, gambar kad pengenalan.</li>
          <li>Hubungan: no. WhatsApp, e-mel, alamat, waris.</li>
          <li>Pekerjaan: jawatan, jabatan, tarikh mula, kehadiran, cuti, tuntutan.</li>
          <li>
            Gaji: akaun bank, no. KWSP, PERKESO dan cukai, status perkahwinan dan bilangan anak untuk kiraan PCB.
          </li>
          <li>Kesihatan terhad: sijil cuti sakit yang anda muat naik.</li>
        </Ul>

        <H2>3. Tujuan</H2>
        <P>
          Data digunakan untuk urusan pekerjaan sahaja: memproses cuti, tuntutan, kehadiran dan gaji, menghantar
          pemberitahuan melalui WhatsApp, dan memenuhi kewajipan undang-undang majikan anda.
        </P>

        <H2>4. Siapa boleh lihat data anda</H2>
        <Ul>
          <li>Anda sendiri, sentiasa.</li>
          <li>Ketua jabatan anda: cuti, kehadiran dan tuntutan yang perlu diluluskan olehnya.</li>
          <li>
            HR, Kewangan dan pengurusan syarikat <b>tempat anda bekerja sahaja</b>.
          </li>
          <li>
            Orang dari syarikat lain atau pentadbir platform HRBoost <b>tidak boleh</b> melihat data peribadi anda,
            kecuali dengan kelulusan bertulis yang bertempoh dan direkod dalam log audit.
          </li>
        </Ul>

        <H2>5. Pihak ketiga yang membantu kami</H2>
        <P>
          Penyedia pengehosan pangkalan data, penyedia penghantaran mesej WhatsApp, penyedia AI untuk membaca resit dan
          menjawab soalan, dan sistem perakaunan yang disambung oleh majikan anda. Setiap pihak hanya menerima data
          yang perlu untuk tugasnya.
        </P>

        <H2>6. Tempoh simpanan</H2>
        <P>
          Data disimpan selagi anda bekerja dengan majikan dan untuk tempoh yang diwajibkan undang-undang selepas itu.
          Jika syarikat dinyahaktif, data disimpan [90] hari sebelum dipadam.
        </P>

        <H2>7. Hak anda</H2>
        <P>
          Anda boleh meminta salinan data anda, membetulkan data yang salah dan bertanya bagaimana data anda digunakan.
          Kebanyakan maklumat boleh diubah sendiri di Profil Saya. Untuk perkara lain, hubungi HR syarikat anda.
        </P>

        <H2 id="hubungi">8. Hubungi</H2>
        <P>
          E-mel: <a href="mailto:hi@hrboost.io">hi@hrboost.io</a>
          <br />
          WhatsApp: <a href="https://wa.me/60194442424">019-444 2424</a>
          <br />
          Alamat: D-G-6 Putra Walk, Taman Pinggiran Putra, 43300 Seri Kembangan, Selangor
        </P>

        <h1 id="terma" className="mt-14 mb-2 text-[32px] leading-[1.15] font-extrabold">
          Terma Penggunaan
        </h1>

        <H3>Perkhidmatan percuma</H3>
        <P>
          HRBoost disediakan secara percuma. Had penggunaan berpatutan dikenakan untuk mesej WhatsApp dan ciri AI bagi
          setiap syarikat.
        </P>
        <H3>Tanggungjawab syarikat</H3>
        <P>
          Syarikat bertanggungjawab ke atas ketepatan maklumat pekerja, polisi syarikat dan semakan akhir gaji serta
          caruman berkanun sebelum dibayar.
        </P>
        <H3>Penggunaan yang dilarang</H3>
        <P>
          Spam, mendaftar menggunakan nombor orang lain, cubaan mengakses data syarikat lain, dan sebarang penggunaan
          yang melanggar undang-undang Malaysia.
        </P>
        <H3>Penggantungan</H3>
        <P>
          Kami boleh menyahaktifkan syarikat atau pengguna yang melanggar terma ini. Pentadbir syarikat akan dimaklumkan
          beserta sebabnya.
        </P>
      </article>
    </div>
  );
}

function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-9 mb-2.5 text-xl font-extrabold text-balance">
      {children}
    </h2>
  );
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-[22px] mb-1.5 text-[17px] font-extrabold">{children}</h3>;
}
function P({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-3 text-base leading-[1.65] text-pretty text-[#33504B] ${className}`}>{children}</p>;
}
function Ul({ children }: { children: ReactNode }) {
  return <ul className="mb-3 list-disc pl-[22px] text-base leading-[1.65] text-[#33504B]">{children}</ul>;
}
