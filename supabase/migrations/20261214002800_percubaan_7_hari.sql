-- =====================================================================
--  Percubaan percuma 7 hari (dahulu 5). Hanya syarikat baharu terkesan: trg_company_trial membaca
--  platform_settings.billing.trial_days semasa syarikat dicipta. Boleh diubah di /admin/langganan.
--  Laman utama kini menawarkan dua pelan: Cuba percuma 7 hari (RM0) atau Langgan terus RM499 setahun
--  (/daftar?pelan=tahunan → bayar sejurus selepas e-mel disahkan).
-- =====================================================================
update platform_settings set value = jsonb_set(value, '{trial_days}', '7')
 where key = 'billing' and coalesce((value->>'trial_days')::int, 5) = 5;
