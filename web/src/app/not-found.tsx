import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-4 bg-page p-6 text-ink">
      <h1 className="m-0 text-2xl font-extrabold">Halaman belum tersedia</h1>
      <p className="m-0 text-sm leading-normal text-subtle">
        Halaman ini tidak wujud atau masih dalam pembinaan.
      </p>
      <Link
        href="/utama"
        className="flex h-12 items-center justify-center rounded-button bg-primary text-sm font-bold text-white!"
      >
        Kembali ke Utama
      </Link>
    </main>
  );
}
