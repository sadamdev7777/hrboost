# HRBoost.io — brief pembinaan

Sistem HR percuma untuk syarikat di Malaysia. Mobile-first (PWA), WhatsApp sebagai saluran utama, sedia untuk AI agent.
Pemilik produk: Sadam. Reka bentuk skrin: kanvas Design "HRBoost.io — Skrin" (nama skrin di bawah ikut nama fail kanvas).

---

## 1. Prinsip yang tidak boleh dilanggar

1. **Simple.** Staff ada 4 tab sahaja: Utama, Mohon, Kelulusan, Saya. Satu skrin = satu tugas. Butang ≥ 44px.
2. **Satu syarikat sahaja.** HR / Finance / CEO / Admin hanya nampak syarikat tempat mereka bekerja. Akses ke syarikat lain = permohonan → kelulusan superadmin → tamat sendiri.
3. **Superadmin tak nampak data peribadi.** Hanya agregat (bilangan, status, penggunaan). IC, gaji, MC, dokumen hanya untuk HR syarikat itu.
4. **Semua kelulusan melalui satu enjin** (`approval_*`). Selesai hari yang sama (SLA), tiada lulus automatik.
5. **Agent-ready.** Setiap kejadian penting → `hr_events` → `automation_rules` → `notifications` → WhatsApp. Setiap tindakan ada RPC yang boleh dipanggil oleh app ATAU agent (parameter `p_via`, `p_on_behalf`).
6. **Nama panggilan** dipakai di semua tempat. Nama penuh (ikut IC) hanya untuk slip gaji, EA, KWSP, surat rasmi.
7. **Kadar berkanun = data**, bukan kod. Dikemas kini oleh platform untuk semua syarikat.

## 2. Stack

| Lapisan | Pilihan |
|---|---|
| Frontend | Next.js (App Router) + Tailwind, PWA (installable), BM sebagai bahasa utama |
| Backend | Supabase: Postgres + RLS, Auth (telefon/OTP), Storage, Edge Functions, pg_cron |
| WhatsApp | Murpati (satu nombor platform HRBoost secara default) |
| Kehadiran | CrossChex Cloud (server EU) — tarik setiap 5 minit |
| Akaun | QuickBooks Online (MTB); syarikat lain eksport CSV |
| AI | Model bahasa untuk baca resit & IC, ringkasan kelulusan, jawab soalan polisi (RAG dari `ai_knowledge_chunks`) |

Rupa: font Plus Jakarta Sans, warna utama `#0F6B5F`, latar `#F4F6F5`, teks `#14211F`, sekunder `#5B6B68`, amaran `#92400E`/`#FEF3E2`, bahaya `#B42318`, AI `#5B4A9E`/`#F3F0FC`. Tiada emoji dalam UI.

## 3. Pangkalan data

Fail: `hrboost_schema_v0.2.sql` (≈2,250 baris). Jalankan sebagai satu migrasi pertama. Diuji pada Postgres 16 dengan stub Supabase: `hrboost_tests_v0.2_approval.sql` dan `hrboost_tests_v0.2_platform.sql` (stub dalam `hrboost_tests_stub_local_only.sql` — **jangan** jalankan stub di Supabase sebenar).

Konsep utama:
- `persons` (orang, satu log masuk) ↔ `employments` (satu bagi setiap syarikat). Gaji, cuti, kehadiran ikut `employments`.
- `user_roles` hanya untuk pekerja syarikat itu (dikawal trigger). Orang luar = `company_access_grants`.
- `platform_admins` = superadmin. `has_role()` **tidak** memberi superadmin akses syarikat.
- `companies.status` = `active`/`suspended`. Syarikat dinyahaktif → semua `has_role` & `is_company_member` jadi false.
- `persons.is_active = false` → `current_person_id()` null → pengguna terkunci.

### RPC utama (panggil dari frontend / agent)

| RPC | Siapa | Guna |
|---|---|---|
| `submit_leave(employment, kod, mula, tamat, half, sebab, lampiran, via, on_behalf, cover_person)` | staff / agent | Mohon cuti + PIC ganti |
| `submit_claim(claim, via, on_behalf)` | staff / agent | Hantar claim draf |
| `submit_attendance_correction(...)` | staff / agent | Betulkan masa |
| `approval_act(task, 'approve'\|'reject'\|'return', komen, via, on_behalf)` | approver / agent | Lulus / tolak / hantar balik |
| `approval_cancel(request, via, on_behalf)` | pemohon | Batal |
| `submit_payroll_run(run)` | HR | Hantar gaji untuk kelulusan |
| `add_employee(...)`, `create_invite(employment)` | HR | Tambah pekerja, jana token jemputan |
| `accept_invite(token, ic4)` → jsonb | staff | Aktifkan akaun (5 cubaan) |
| `complete_onboarding_step(employment, step)` | staff | Kemajuan onboarding (8 langkah) |
| `register_company(nama, saiz, nama_penuh, telefon, email)` | awam selepas OTP | Daftar syarikat; pendaftar = Admin+HR+CEO |
| `set_company_holidays(company, tahun, ids[])` | HR | Pilih cuti umum (≥ 11 hari, 5 wajib) |
| `team_birthdays(company, dari, hingga)` | ahli syarikat | Hari & bulan sahaja |
| `request_company_access(kod, peranan, hari, sebab)` | sesiapa | Minta akses syarikat lain |
| `decide_company_access(grant, lulus, nota)` / `revoke_company_access(grant)` | superadmin / admin sasaran | |
| `sa_company_overview()`, `sa_set_company_status()`, `sa_set_person_active()`, `sa_set_company_limits()` | superadmin | Agregat & kawalan |
| `match_attendance_workno(employment, workno)` | HR | Padan workno CrossChex |

### Fungsi untuk Edge Function sahaja (service role)
`ingest_punch`, `ingest_attendance`, `process_hr_events`, `approval_sla_tick`, `bump_usage`.

## 4. Edge Functions & jadual (pg_cron)

| Fungsi | Jadual | Kerja |
|---|---|---|
| `events-worker` | setiap minit | `select process_hr_events()` |
| `notify-sender` | setiap minit | Baca `notifications` status `pending` → `bump_usage(company,'wa')` → hantar melalui Murpati → `sent`/`failed`. Jika had habis: `skipped` + maklum Admin sekali sahaja |
| `sla-tick` | setiap 15 minit | `select approval_sla_tick()` |
| `crosschex-sync` | setiap 5 minit | Untuk setiap syarikat dengan CrossChex: token (cache sehingga `expires`, ralat `TOKEN_EXPIRES` → minta baru), `getrecord` dari `last_synced_at − 10 min` hingga kini, 100 rekod/halaman, panggil `ingest_punch` (uuid, `checktime` UTC, `workno`, peranti). Simpan `integration_sync_state` |
| `whatsapp-inbound` | webhook Murpati | Balasan staff: "LULUS" / "TOLAK sebab" → `approval_act` dengan `p_on_behalf`; teks bebas → agent AI |
| `invite-link` | HTTP | Token jemputan → cipta sesi Supabase untuk nombor itu → halaman sahkan IC |
| `auth-sms-hook` | Auth hook | Hantar OTP log masuk melalui WhatsApp (Murpati) |
| `ai-receipt`, `ai-ic` | HTTP | Baca resit / IC → isi borang; `bump_usage(company,'ai')` dahulu |
| `payroll-calc` | HTTP | Kira gaji dari `statutory_rates` → `payslips` + `payslip_lines` |
| `payslip-pdf` | selepas lulus | Jana PDF A4 (rujuk skrin SlipGaji) → Storage → WhatsApp |
| `accounting-sync` | setiap 10 minit | `accounting_sync_queue` → QuickBooks (bill claim, jurnal gaji) |

Rahsia (CrossChex api_key/secret, QuickBooks, Murpati, AI) **hanya** dalam Supabase secrets / Vault. Tidak pernah dipaparkan semula di UI — HR hanya boleh "Tukar".

## 5. Peta skrin (nama fail kanvas → laluan)

Reka bentuk setiap skrin ada dalam folder `design/` (fail `NamaSkrin.dc.html`). Ikut teks, susun atur, warna dan aliran pautan dalam fail tersebut dengan tepat. `design/canvas.json` menyenaraikan semua skrin mengikut seksyen. Fail `design/Mohon.dc.html` ialah tab Mohon (pilih jenis permohonan).

**Awam:** `Homepage` → `/` · `Privasi` → `/privasi` · `DaftarSyarikat` → `/daftar` · `OTPSyarikat` → `/daftar/sahkan` · `Login` → `/masuk` · `OTP` → `/masuk/kod`

**Onboarding syarikat (Admin):** `OnboardingSyarikat` → `/mula` · langkah: `SyarikatLangkah` (2) → `ImportPekerja` (3) → `SyarikatJabatan` (4) → `SyarikatPeranan` (5) → `SyarikatJemput` (6) → `SyarikatSelesai`. Butang Seterusnya dikunci jika ada jabatan tanpa ketua.

**Onboarding staff:** `Daftar` (pautan jemputan + 4 digit IC) → `Onboarding` → `OnboardingNama` → `OnboardingSelfie` (kamera depan, `capture="user"`) → `OnboardingLangkah` (bank & waris) → `OnboardingDokumen` (IC, AI baca) → `OnboardingPeribadi` (alamat, status kahwin, anak untuk PCB, KWSP, cukai) → `OnboardingHandbook` (wajib tanda faham) → `OnboardingPasang` → `OnboardingSelesai`.

**Staff:** `Main` (atau `KetuaUtama` untuk ketua jabatan) · `MohonCuti` · `Kelulusan` · `Butiran` · `PermohonanSaya` · `Saya` · `Cuti` · `Tuntutan` · `BuatClaim` · `Kehadiran` · `PembetulanMasa` · `Gaji` · `SlipGaji` (PDF) · `PembantuAI` · `Profil` · `ProfilUbah` · `HariJadi`

**HR / pengurusan (satu syarikat):** `DashboardHR` · `AksesSyarikat` · `Pekerja` · `TambahPekerja` · `ProfilPekerja` · `ProsesGaji` → `GajiSemak` → `GajiBayar` · `Tetapan` dan sub: `AliranApproval`, `T_WakilKelulusan`, `Automasi`, `T_JenisCuti`, `CutiUmum`, `T_JenisClaim`, `T_Syarikat`, `T_KadarBerkanun`, `T_IntegrasiAkaun`, `T_Pengguna`, `T_PengetahuanAI`, `IntegrasiKehadiran`

**Superadmin (desktop, `/admin`):** `SA_Dashboard` · `SA_Syarikat` · `SA_SyarikatButiran` · `SA_Akses` · `SA_Pengguna` · `SA_Log` · `SA_Tetapan`

Menu "Pengurusan" dalam `Saya` hanya dipaparkan jika `has_role(company, '{hr,finance,ceo,admin}')`.

## 6. Keselamatan & PDPA

- RLS hidup pada semua jadual. Frontend guna kunci anon sahaja; tindakan sensitif melalui RPC `security definer`.
- Buka akaun bank / IC / MC / slip orang lain → tulis `data_access_log`.
- Tindakan superadmin & akses silang → `platform_audit_log` (tiada update/delete).
- Gambar IC, selfie, MC, resit → bucket Storage peribadi, URL bertandatangan (≤ 5 minit).
- Resit claim: dua butang. **Ambil gambar** = `<input type="file" accept="image/*" capture="environment">` (buka kamera belakang terus). **Muat naik** = `<input type="file" accept="image/*,application/pdf" multiple>` (galeri, screenshot e-resit, PDF). Mampatkan gambar di telefon (≤ 1600px, JPEG ~0.8) sebelum upload; had 10 MB/fail; boleh lebih dari satu resit setiap claim.
- Jumlah gaji disorok secara default di skrin (`Gaji`).
- Notis privasi & terma dalam `Privasi` ialah **draf** — perlu semakan peguam sebelum pelancaran.

## 7. Fasa pembinaan & definisi siap

| Fasa | Skop | Siap bila |
|---|---|---|
| A | Migrasi skema, seed MTB, `platform_admins` (Sadam), import staff MTB | Ujian SQL lulus di Supabase staging |
| B | Auth OTP WhatsApp, Login, onboarding staff, Utama, Mohon Cuti, Kelulusan, Butiran, Permohonan Saya | Amin mohon cuti → 3 tier lulus dari telefon, baki betul |
| C | `events-worker`, `notify-sender`, `whatsapp-inbound`, `sla-tick` | Ketua lulus dengan balas "LULUS" di WhatsApp; PIC ganti dapat mesej |
| D | Claim + `ai-receipt`, Tetapan cuti/claim/cuti umum, Hari Jadi | Claim RM1,250 naik ke CEO; QuickBooks terima bill |
| E | `crosschex-sync`, Kehadiran, Pembetulan masa, Integrasi Kehadiran | Punch masuk dalam ≤ 5 minit; notis lewat dihantar |
| F | Payroll (`payroll-calc`, `payslip-pdf`, fail berkanun), Proses Gaji 4 langkah | 2 bulan dijalankan selari & sepadan dengan kalkulator rasmi |
| G | Homepage, daftar & onboarding syarikat, superadmin, akses silang | Syarikat baru boleh daftar → jemput staff → staff aktif tanpa bantuan |
| H | Pilot jabatan Tour MTB 2 minggu → semua MTB → DO IT → Avenue | |

## 8. Perkara terbuka (perlu disahkan sebelum pelancaran)

- **Kunci CrossChex** yang pernah ditampal dalam chat perlu dijana semula sebelum digunakan.
- Nilai sebenar: had WhatsApp/AI default, tempoh hantar claim, cuti haji, kadar caruman majikan, nombor majikan, nombor SSM — semua bertanda `[ ]` dalam reka bentuk.
- Tarikh cuti umum ikut warta setiap tahun (terutama cuti berasaskan kalendar Hijri / lunar) — import dari sumber rasmi, jangan teka.
- Enjin PCB mesti disahkan dengan kalkulator LHDN sebelum gaji pertama.
- Semakan undang-undang untuk Notis Privasi & Terma.

## Bahasa antara muka
**English ialah bahasa lalai**; setiap pengguna boleh menukar kepada Bahasa Melayu (Saya → Bahasa, atau suis EN/BM di halaman awam). Pilihan disimpan dalam `persons.language` (`en`/`ms`), kuki `hrb_bahasa` dan localStorage. Mesej WhatsApp, balasan Pembantu AI dan draf surat ikut bahasa setiap orang.

- **Teks sumber dalam kod kekal Bahasa Melayu rasmi** dan dibalut `tr("…", ...nilai)` (`web/src/lib/i18n.ts`); terjemahan English dalam `web/src/lib/kamus/en.ts`. Pemboleh ubah ditulis `{0}`, `{1}`.
- Mesej daripada pangkalan data (raise exception, nama komponen, semakan gaji) diterjemah dengan `trRalat()` menggunakan `web/src/lib/kamus/ralat.ts` (`%` = nilai, `[%]` = tanda peratus).
- Mesej WhatsApp diterjemah di pangkalan data: jadual `message_i18n` + `translate_message()` + pencetus pada `notifications`. Tambah peraturan apabila menulis mesej baharu.
- Teks baharu: tulis dalam BM dengan `tr()`, kemudian tambah entri English dalam kamus. `node web/scripts/i18n-codemod.cjs --keys` menyenaraikan kunci.
- Bahasa Melayu mesti rasmi: tiada bahasa pasar (dah, tak, nak, je, kat) dan tiada istilah Indonesia. Istilah tetap: tuntutan (bukan claim), pekerja (bukan staff), pelulus, peringkat, Kewangan, Pentadbir, Pentadbir Platform, Papan Pemuka, swafoto, buku panduan, kad pengenalan, e-mel, lalai, perbatuan, letak kereta, pengganti tugas, orientasi pekerja, persediaan syarikat. Nama jenama kekal (WhatsApp, QuickBooks, KWSP, PERKESO, HR, CEO, AI). Ikut teks dalam reka bentuk HRBoost.io — Skrin.
- Ujian e2e berjalan dalam BM (`web/e2e/_bahasa.cjs`); `web/e2e/bahasa-en.cjs` mengimbas skrin English untuk teks BM yang tertinggal.
