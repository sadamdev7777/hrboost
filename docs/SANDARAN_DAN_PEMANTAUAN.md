# Sandaran & pemantauan ralat

## Pemantauan ralat (tanpa perkhidmatan luar)
- Pelayar menghantar ralat JavaScript yang tidak ditangkap dan ralat paparan (sempadan `app/error.tsx`) ke RPC `log_client_error` (`web/src/lib/laporRalat.ts`).
- Disimpan dalam jadual `client_errors` (RLS tanpa polisi — hanya melalui fungsi). Laluan disimpan tanpa query string (token jemputan tidak terlepas).
- Had: 30 rekod sejam setiap pengguna, 5 bagi ralat yang sama; 20 setiap muat halaman di pelayar.
- Pentadbir Platform: **/admin/ralat** — dikumpulkan ikut jenis (bilangan, pengguna, kod syarikat, versi binaan `NEXT_PUBLIC_RELEASE` = `COMMIT_REF` Netlify). Tiada nama/IC dipaparkan.
- Rekod > 90 hari dipadam oleh pg_cron `hrboost-purge-client-errors`.
- Ralat Edge Function & pangkalan data: Supabase Dashboard → Logs (atau `get_logs`). Jika mahu Sentry kemudian, tambah DSN dalam `laporRalat()` — tiada perubahan lain diperlukan.

## Sandaran pangkalan data
1. **Supabase:** pelan Pro menyimpan sandaran harian 7 hari (PITR pilihan). Pelan percuma **tiada** sandaran automatik.
2. **Sandaran sendiri (disyorkan, pelan apa pun):** aliran kerja GitHub `.github/workflows/sandaran.yml` setiap hari 2:23 pagi MYT.
   - Tetapkan GitHub Secrets: `SUPABASE_DB_URL` (Dashboard → Project Settings → Database → Connection string, mod *Session*) dan `SANDARAN_KATA_LALUAN` (frasa panjang, simpan di pengurus kata laluan).
   - Hasil: artifak `hrboost-<tarikh>.sql.gz.gpg` (AES-256), disimpan 30 hari.
   - Manual: `SUPABASE_DB_URL=… SANDARAN_KATA_LALUAN=… bash supabase/scripts/sandaran.sh`.
3. **Pulihkan** ke projek baharu: `gpg -d fail.sql.gz.gpg | gunzip | psql "$SASARAN_DB_URL"`. Fail Storage (IC, swafoto, resit) **tidak** termasuk — guna penyalinan bucket Supabase jika perlu.
4. Uji pemulihan sekurang-kurangnya sekali sebulan pada projek staging.
