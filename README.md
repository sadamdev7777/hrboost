# HRBoost.io

Sistem HR percuma untuk syarikat di Malaysia. Panduan utama projek: [`CLAUDE.md`](CLAUDE.md). Reka bentuk skrin: [`design/`](design/).

## Struktur

| Folder | Isi |
|---|---|
| `web/` | Aplikasi Next.js (App Router) + TypeScript + Tailwind CSS v4 |
| `supabase/` | Konfigurasi Supabase CLI, migrasi skema v0.2, ujian SQL |
| `supabase/tests/local_only/` | Stub Supabase untuk ujian **tempatan sahaja** |
| `design/` | Reka bentuk semua skrin (HTML) |
| `docs/` | Bahan sokongan (cth. bandingan rupa halaman log masuk) |

## Keperluan

- Node.js 22 dan npm
- Docker (untuk `supabase start` dan ujian SQL pada Postgres 16)
- `psql` (klien Postgres)

## Pemasangan

```bash
npm install
```

```bash
npm --prefix web install
```

## Pangkalan data tempatan

Mulakan Supabase tempatan. Migrasi dalam `supabase/migrations` dijalankan secara automatik:

```bash
npx supabase start
```

Jalankan semula migrasi dari kosong:

```bash
npx supabase db reset
```

Jana jenis TypeScript daripada skema (ke `web/src/lib/database.types.ts`):

```bash
npm run db:types
```

Hentikan Supabase tempatan:

```bash
npx supabase stop
```

## Ujian SQL

```bash
npm run db:test
```

Skrip `supabase/scripts/run-sql-tests.sh` memulakan bekas Docker `pgvector/pgvector:pg16` pada port 55432, kemudian bagi setiap fail dalam `supabase/tests/*.sql` mencipta pangkalan data baharu dan menjalankan:

1. stub `supabase/tests/local_only/hrboost_tests_stub_local_only.sql`
2. semua migrasi dalam `supabase/migrations/`
3. fail ujian itu

Keputusan `LULUS` / `GAGAL` dipaparkan bagi setiap fail. Ralat yang dijangka (ujian "mesti gagal") muncul dalam output sebagai `ERROR` dan tidak menggagalkan ujian. Jika Postgres 16 (dengan pgvector) sudah berjalan, gunakan `SKIP_DOCKER=1 PGPORT=5432 npm run db:test`.

> **Amaran:** fail dalam `supabase/tests/local_only/` hanya untuk ujian tempatan. Jangan sekali-kali jalankannya pada projek Supabase sebenar. Skrip ujian menolak sebarang hos selain `localhost` / `127.0.0.1`. Stub tidak boleh dijalankan pada `supabase start` kerana skema `auth` sebenar sudah wujud di sana.

### Ujian pada Supabase sebenar (staging)

Stub `local_only` tidak boleh dijalankan pada Supabase sebenar. Untuk staging, tukar fail ujian kepada satu blok `DO` yang memakai `auth` sebenar (`request.jwt.claims`):

```bash
python3 supabase/scripts/tests_to_supabase.py supabase/tests/hrboost_tests_v0.2_approval.sql > /tmp/ujian_staging.sql
```

Blok itu sentiasa tamat dengan `RAISE EXCEPTION 'HRBOOST_TEST_RESULT:…'` yang membawa hasil ujian dalam JSON. Ralat ini disengajakan: ia memaksa ROLLBACK penuh supaya tiada data ujian tertinggal. Jalankannya dalam SQL Editor projek staging (atau melalui `psql`), kemudian bandingkan hasil dengan larian tempatan.

Nota: dalam ujian platform T7, dua notifikasi dicipta dalam transaksi yang sama, jadi susunan `order by created_at` antara Lily dan Zulfa boleh bertukar. Kandungannya tetap sama.

## Projek Supabase

| Projek | Ref | Kegunaan |
|---|---|---|
| `hrboost-staging` | `gldhywelqvfxlsqipnzq` (Singapura, Postgres 17) | Staging Fasa A: migrasi `20261107000000`, `20261107000100` dan `20261107000200` dipasang |

Kunci projek tidak disimpan dalam repo.

## Aplikasi web

```bash
cp web/.env.example web/.env.local
```

Isi `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan nilai daripada `npx supabase status` (kunci tempatan sahaja). Kemudian:

```bash
npm run dev
```

Buka http://localhost:3000/masuk untuk halaman log masuk (tiruan `design/Login.dc.html`).

Semakan lain:

```bash
npm --prefix web run lint
```

```bash
npm --prefix web run build
```

## Tema

Token warna dan bentuk ditakrif dalam `web/src/app/globals.css` (`@theme`) mengikut `CLAUDE.md` §2 dan warna dalam `design/`: `primary` #0F6B5F, `page` #F4F6F5, `ink` #14211F, `muted` #5B6B68, `warning` #92400E / `warning-soft` #FEF3E2, `danger` #B42318, `ai` #5B4A9E / `ai-soft` #F3F0FC, dan lain-lain. Font Plus Jakarta Sans dimuat melalui `next/font/google`.

## Rahsia

Tiada kunci rahsia dalam kod. Frontend hanya menggunakan kunci awam (anon) daripada pemboleh ubah persekitaran. Rahsia integrasi disimpan dalam Supabase secrets / Vault sahaja.
