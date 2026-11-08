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

Fail ujian: `hrboost_tests_v0.2_approval`, `hrboost_tests_v0.2_platform`, `hrboost_tests_b_onboarding` (jemputan & orientasi), `hrboost_tests_c_whatsapp` (balasan WhatsApp & giliran notifikasi), `hrboost_tests_d_profil` (kalendar cuti, profil, tukar bank), `hrboost_tests_d_hr` (pengurusan pekerja), `hrboost_tests_d_tetapan` (aliran kelulusan, minimum cuti, tempoh tuntutan, wakil) dan `hrboost_tests_e_kehadiran` (kehadiran & pembetulan masa). Skrip `supabase/scripts/run-sql-tests.sh` memulakan bekas Docker `pgvector/pgvector:pg16` pada port 55432, kemudian bagi setiap fail dalam `supabase/tests/*.sql` mencipta pangkalan data baharu dan menjalankan:

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
| `hrboost-staging` | `gldhywelqvfxlsqipnzq` (Singapura, Postgres 17) | Staging: semua migrasi dalam `supabase/migrations` dipasang (sehingga `20261109000000`), termasuk bucket storan `peribadi` dan jadual pg_cron |

Kunci projek tidak disimpan dalam repo.

### Aplikasi staging

- Laman: https://hrboost-staging.netlify.app (projek Netlify `hrboost-staging`, binaan daripada `netlify.toml`, folder `web/`)
- Pemboleh ubah Netlify: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kunci awam/publishable staging sahaja)
- Data demo rekaan yang sama seperti `supabase/seed.sql` (syarikat DEMO, 7 orang). Padam sebelum data MTB sebenar diimport.
- OTP sementara: hook Postgres `staging_dev.send_sms_hook` menyimpan kod dalam `staging_dev.sms_outbox` (skema peribadi, tidak didedahkan API). Nombor demo menggunakan kod ujian tetap yang ditetapkan dalam papan pemuka. Diganti oleh `auth-sms-hook` (WhatsApp) bila Murpati tersedia.

Tetapan papan pemuka Supabase (Authentication) yang diperlukan untuk staging:

1. **Auth Hooks** → Add hook → *Send SMS hook* → Postgres → skema `staging_dev`, fungsi `send_sms_hook`.
2. **Sign In / Providers → Phone** → hidupkan. Jika diminta penyedia SMS, isi nilai palsu (hook mengatasi penyedia). *Test Phone Numbers and OTPs*: `60100000001=123456, 60100000002=123456, … 60100000007=123456`.
3. **URL Configuration** → Site URL: `https://hrboost-staging.netlify.app`.

## Aplikasi web

```bash
cp web/.env.example web/.env.local
```

Isi `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan nilai daripada `npx supabase status` (kunci tempatan sahaja). Kemudian:

```bash
npm run dev
```

Buka http://localhost:3000/masuk.

### Log masuk tempatan (data demo)

`npx supabase db reset` memasang data demo daripada `supabase/seed.sql` (tempatan sahaja, semua rekaan). Log masuk dengan nombor di bawah dan kod **123456**:

| Taip (selepas +60, 9 angka) | Nama | Peranan |
|---|---|---|
| 100000001 | Sadam | CEO + Pentadbir |
| 100000002 | Lily | HR |
| 100000003 | Zuerin | Ketua Jabatan Pelancongan |
| 100000004 | Amin | Pekerja |
| 100000005 | Farah | Kewangan |
| 100000006 | Zulfa | Pekerja |

Nombor lain juga boleh meminta kod: kod disimpan dalam `dev.sms_outbox` (hook "Send SMS" tempatan) dan tiada mesej dihantar:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select phone, otp from dev.sms_outbox order by id desc limit 5"
```

Di staging/produksi, kod OTP dihantar melalui WhatsApp oleh Edge Function `auth-sms-hook` (sudah ditulis, belum dipasang — lihat bahagian "OTP melalui WhatsApp" di bawah).

### Laluan skrin

| Laluan | Skrin reka bentuk |
|---|---|
| `/masuk`, `/masuk/kod` | Login, OTP |
| `/jemputan`, `/jemputan/[token]` | Daftar (aktifkan akaun melalui pautan jemputan + 4 digit IC + OTP) |
| `/orientasi` | Onboarding (senarai semak 8 langkah) |
| `/orientasi/nama`, `/swafoto`, `/bank`, `/kad-pengenalan`, `/peribadi`, `/buku-panduan`, `/pasang`, `/selesai` | OnboardingNama, OnboardingSelfie, OnboardingLangkah, OnboardingDokumen, OnboardingPeribadi, OnboardingHandbook, OnboardingPasang, OnboardingSelesai |
| `/utama` | Main (pekerja) / KetuaUtama (ketua jabatan) |
| `/mohon`, `/mohon/cuti` | Mohon, MohonCuti (termasuk sijil MC: Ambil gambar / Muat naik) |
| `/permohonan`, `/permohonan/[id]` | PermohonanSaya, Butiran (paparan pemohon) |
| `/kelulusan`, `/kelulusan/[id]` | Kelulusan, Butiran (paparan pelulus) |
| `/saya` | Saya |
| `/tuntutan`, `/tuntutan/baru`, `/tuntutan/[id]` | Tuntutan, BuatClaim |
| `/cuti`, `/hari-jadi`, `/profil`, `/profil/ubah` | Cuti, HariJadi, Profil, ProfilUbah |
| `/kehadiran`, `/kehadiran/betulkan` | Kehadiran, PembetulanMasa |
| `/pengurusan` | DashboardHR |
| `/pengurusan/pekerja`, `/pengurusan/pekerja/baru`, `/pengurusan/pekerja/[id]` | Pekerja, TambahPekerja, ProfilPekerja |
| `/pengurusan/akses` | AksesSyarikat |
| `/pengurusan/tetapan` (+ `/aliran`, `/wakil`, `/automasi`, `/cuti`, `/cuti-umum`, `/tuntutan`, `/syarikat`, `/kadar`, `/akaun`, `/pengguna`, `/kehadiran`) | Tetapan, AliranApproval, T_WakilKelulusan, Automasi, T_JenisCuti, CutiUmum, T_JenisClaim, T_Syarikat, T_KadarBerkanun, T_IntegrasiAkaun, T_Pengguna, IntegrasiKehadiran |
| `/privasi` | Privasi (DRAF — perlu semakan peguam) |

Fail peribadi (swafoto, kad pengenalan, sijil MC) disimpan dalam bucket storan peribadi `peribadi`, folder `<person_id>/`. Gambar dimampatkan di telefon (≤ 1600px, JPEG 0.8) sebelum dimuat naik dan dipaparkan melalui URL bertandatangan 5 minit. Hanya pemilik, HR/Pentadbir syarikat itu dan pelulus permohonan berkaitan boleh membacanya.

Data dimuatkan terus di pelayar dengan kunci anon; RLS pangkalan data mengawal apa yang boleh dilihat. Tindakan (mohon, lulus, tolak, batal) melalui RPC `submit_leave`, `approval_act` dan `approval_cancel`.

### Ujian hujung-ke-hujung

Selepas `npx supabase db reset` dan dengan aplikasi berjalan di `localhost:3000` (bina dengan `npm --prefix web run build`, kemudian `npx --prefix web next start`):

```bash
node web/e2e/aliran-cuti.cjs
```

```bash
node web/e2e/orientasi.cjs
```

Ujian lain dalam `web/e2e/`: `tuntutan.cjs` (RM1,250 → Ketua → Kewangan → CEO), `profil-cuti.cjs`, `pengurusan-hr.cjs`, `tetapan.cjs`, `kehadiran.cjs`. Untuk staging: `E2E_BASE=https://hrboost-staging.netlify.app`.

- `aliran-cuti.cjs`: Amin memohon cuti 23–28 Dis → Zuerin, Lily dan Sadam meluluskan dari telefon masing-masing → baki Amin 8 → 5 hari.
- `orientasi.cjs`: HR menjemput pekerja baharu → pautan jemputan + 4 digit IC + OTP → 8 langkah orientasi (swafoto, kad pengenalan dan lain-lain) → Amin memohon MC bersama gambar sijil → ketua jabatan membuka sijil itu.

Jalankan `npx supabase db reset` sebelum setiap larian (ujian mencipta data).

### Automasi & WhatsApp (Fasa C)

| Komponen | Bagaimana | Status |
|---|---|---|
| events-worker | pg_cron `hrboost-events-worker` setiap minit → `process_hr_events()` | Berjalan (tempatan & staging) |
| sla-tick | pg_cron `hrboost-sla-tick` setiap 15 minit → `approval_sla_tick()` | Berjalan (tempatan & staging) |
| notify-sender | Edge Function → `notify_next()` (semak had, tanda *skipped* + maklum Pentadbir sekali sebulan) → Murpati → `notify_mark()` (cuba semula maksimum 3 kali) | Kod siap & diuji; belum dipasang (perlu Murpati) |
| whatsapp-inbound | Edge Function (webhook) → `whatsapp_handle_reply()`: `LULUS`, `LULUS 2`, `TOLAK <sebab>`, `TOLAK 2 <sebab>`; lebih daripada satu tugasan → senarai bernombor | Kod siap & diuji; belum dipasang (perlu Murpati) |

Sementara Murpati belum dikonfigurasi, notifikasi kekal dalam jadual `notifications` dengan status `pending`. Semua panggilan Murpati berada dalam `supabase/functions/_shared/murpati.ts` — laraskan fail itu sahaja bila spesifikasi API tersedia.

Ujian integrasi fungsi (tempatan, pelayan Murpati palsu, tiada mesej sebenar):

```bash
node supabase/scripts/ujian-fungsi-whatsapp.cjs
```

Bila Murpati tersedia: tetapkan rahsia `MURPATI_API_URL`, `MURPATI_API_KEY`, `MURPATI_WEBHOOK_SECRET`; pasang `notify-sender`, `whatsapp-inbound` dan `auth-sms-hook`; jadualkan `notify-sender` setiap minit dengan pg_cron + pg_net (kunci service role dalam Vault); tetapkan URL webhook Murpati ke `whatsapp-inbound`.

### Kehadiran CrossChex (Fasa E)

`supabase/functions/crosschex-sync` menarik imbasan CrossChex Cloud (`api.eu.crosschexcloud.com`) bagi setiap syarikat mengikut kekerapan pilihan (5/15/30 minit): token disimpan dalam Vault hingga `expires` (ralat `TOKEN_EXPIRES` → token baharu), julat `last_synced_at − 10 minit` hingga kini, 100 rekod setiap halaman, `ingest_punch` (tiada pendua). HR mengisi kunci di **Tetapan → Integrasi Kehadiran**; kunci, rahsia dan token disimpan dalam Supabase Vault dan tidak pernah dipaparkan semula. Rekod yang telah dibetulkan (pembetulan masa diluluskan) tidak ditulis ganti oleh imbasan seterusnya.

Ujian integrasi (tempatan, pelayan CrossChex palsu):

```bash
node supabase/scripts/ujian-fungsi-crosschex.cjs
```

**Belum dipasang di staging** — kunci CrossChex yang pernah ditampal dalam chat perlu dijana semula dahulu (CLAUDE.md §8). Bila sedia: pasang fungsi `crosschex-sync`, kemudian jadualkan setiap 5 minit dengan pg_cron + pg_net (kunci service role dalam Vault). `CROSSCHEX_URL_OVERRIDE` hanya untuk ujian tempatan — jangan tetapkan di Supabase sebenar.

### OTP melalui WhatsApp (staging/produksi)

`supabase/functions/auth-sms-hook` menerima kod OTP daripada Supabase Auth dan menghantarnya melalui WhatsApp (Murpati). **Belum dipasang** — butiran API Murpati belum tersedia; laraskan fungsi `hantarWhatsApp` mengikut spesifikasi Murpati. Rahsia (`SEND_SMS_HOOK_SECRETS`, `MURPATI_API_URL`, `MURPATI_API_KEY`) disimpan dalam Supabase secrets sahaja.

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
