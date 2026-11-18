\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian langganan: percubaan 7 hari, sebut harga dengan kempen / baucar (tempoh & had), invois → bayar (idempotent),
-- pembaharuan menyambung tarikh, peralihan harian trial → grace → readonly, permohonan disekat semasa baca sahaja.
-- Gunakan stub local_only (test.uid / test.role / service role). Jangan jalankan pada Supabase sebenar.

-- Syarikat sedia ada sebelum migrasi = dikecualikan; syarikat ini dicipta selepas migrasi → percubaan
insert into companies(id,code,name) values
 ('00000000-0000-0000-0000-0000000000c1','ABC','ABC SDN BHD'),
 ('00000000-0000-0000-0000-0000000000c2','XYZ','XYZ SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,4) g;
insert into persons(id,auth_user_id,full_name,preferred_name,email) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','ALI','Ali','ali@abc.my'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','BADRUL','Badrul','b@abc.my'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','CHONG','Chong','c@xyz.my'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','SA','Sadam','sa@hrboost.io');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ABC001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','ABC002','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c2','XYZ001','active','2020-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c2','admin');
insert into platform_admins(person_id) values ('00000000-0000-0000-0000-000000000004');

\echo '=== L1: syarikat baharu → percubaan 7 hari ==='
do $$ begin
  assert (select billing_status from companies where code = 'ABC') = 'trial', 'percubaan';
  assert (select trial_ends_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from companies where code = 'ABC'), '7 hari';
end $$;

\echo '=== L2: Pentadbir Platform cipta kempen & baucar; pekerja biasa tidak boleh sebut harga ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select sa_voucher_save('{"name":"Pelancaran","kind":"percent","value":10}'::jsonb) is not null as kempen;
select sa_voucher_save('{"code":"raya50","name":"Raya","kind":"fixed","value":50,"max_redemptions":1}'::jsonb) is not null as raya;
select sa_voucher_save('{"code":"LAMA","name":"Lama","kind":"percent","value":30,"ends_at":"2020-01-01"}'::jsonb) is not null as lama;
set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ begin
  begin perform billing_quote('00000000-0000-0000-0000-0000000000c1'); raise exception 'patut gagal';
  exception when others then assert sqlerrm like 'Hanya Pentadbir%', 'pekerja biasa ditolak: ' || sqlerrm; end;
end $$;

\echo '=== L3: sebut harga — kempen automatik, kod lebih baik, kod tamat, kod tidak sah ==='
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ declare q jsonb; begin
  q := billing_quote('00000000-0000-0000-0000-0000000000c1');
  assert (q->>'price_sen')::int = 49900 and (q->>'discount_sen')::int = 4990 and (q->>'total_sen')::int = 44910, 'kempen 10%: ' || q::text;
  q := billing_quote('00000000-0000-0000-0000-0000000000c1', ' raya50 ');
  assert (q->>'discount_sen')::int = 5000 and q->>'voucher_code' = 'RAYA50', 'RM50 lebih baik daripada 10%: ' || q::text;
  q := billing_quote('00000000-0000-0000-0000-0000000000c1', 'LAMA');
  assert q->>'code_error' = 'Kod ini telah tamat tempoh' and (q->>'discount_sen')::int = 4990, 'kod tamat: kempen kekal';
  q := billing_quote('00000000-0000-0000-0000-0000000000c1', 'TIADA');
  assert q->>'code_error' = 'Kod baucar tidak sah', 'kod tidak sah';
end $$;

\echo '=== L4: invois → bayar (service role) → aktif setahun; idempotent; baucar dikira ==='
do $$ declare inv jsonb; begin
  inv := billing_create_invoice('00000000-0000-0000-0000-0000000000c1', 'RAYA50');
  assert (inv->>'total_sen')::int = 44900 and inv->>'number' like 'HRB-%', 'invois RM449: ' || inv::text;
  assert inv->>'payer_email' = 'ali@abc.my' and inv->'buyer'->>'name' = 'ABC SDN BHD', 'pembayar & pembeli';
  perform set_config('test.inv', inv->>'id', false);
  begin perform billing_create_invoice('00000000-0000-0000-0000-0000000000c1', 'TIADA'); raise exception 'patut gagal';
  exception when others then assert sqlerrm = 'Kod baucar tidak sah', 'kod tidak sah ditolak semasa invois'; end;
end $$;
-- Invois kedua (kod tidak sah) gagal, invois pertama masih pending
set test.role='service_role'; set test.uid='';
do $$ declare r jsonb; inv uuid := current_setting('test.inv')::uuid; begin
  perform billing_set_checkout(inv, 'chip_123', 'https://gate.chip-in.asia/p/chip_123/');
  r := billing_mark_paid(inv, 'chip_123', 'fpx');
  assert r->>'receipt' like 'HRB-R-%', 'resit';
  assert (billing_mark_paid(inv, 'chip_123')->>'already')::boolean, 'idempotent';
  assert (select billing_status from companies where code = 'ABC') = 'active', 'aktif';
  assert (select paid_until::date - now()::date between 364 and 366 from companies where code = 'ABC'), 'setahun';
  assert (select count(*) from billing_redemptions) = 1, 'baucar dikira sekali';
  assert exists (select 1 from notifications where person_id = '00000000-0000-0000-0000-000000000001' and message ~ '(Bayaran langganan HRBoost RM449\.00|subscription payment of RM449\.00)'), 'pembayar dimaklumkan';
end $$;

\echo '=== L5: baucar had 1 penuh untuk syarikat lain; pembaharuan menyambung tarikh ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ declare q jsonb; begin
  q := billing_quote('00000000-0000-0000-0000-0000000000c2', 'RAYA50');
  assert q->>'code_error' = 'Had penggunaan kod ini telah penuh', 'had penuh: ' || q::text;
end $$;
set test.uid='00000000-0000-0000-0000-00000000a001';
do $$ declare inv jsonb; q jsonb; begin
  q := billing_quote('00000000-0000-0000-0000-0000000000c1', 'RAYA50');
  assert q->>'code_error' = 'Syarikat anda telah menggunakan kod ini', 'sekali bagi setiap syarikat';
  inv := billing_create_invoice('00000000-0000-0000-0000-0000000000c1');
  assert (inv->>'period_start')::date >= (now() + interval '364 days')::date, 'pembaharuan bermula selepas tempoh semasa: ' || (inv->>'period_start');
  perform set_config('test.inv2', inv->>'id', false);
end $$;
set test.role='service_role'; set test.uid='';
do $$ begin
  perform billing_mark_paid(current_setting('test.inv2')::uuid, 'chip_456');
  assert (select paid_until::date - now()::date between 729 and 732 from companies where code = 'ABC'), 'dua tahun';
end $$;

\echo '=== L6: peralihan harian — trial tamat → grace → readonly; permohonan disekat ==='
update companies set trial_ends_at = now() - interval '1 hour' where code = 'XYZ';
do $$ begin
  perform billing_tick();
  assert (select billing_status from companies where code = 'XYZ') = 'grace', 'grace';
  assert exists (select 1 from notifications where person_id = '00000000-0000-0000-0000-000000000003' and message ~ '(Sila bayar dalam 14 hari|Please pay within 14 days)'), 'makluman grace';
  perform billing_tick();
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000003' and message ~ '(Sila bayar dalam|Please pay within)') = 1, 'makluman sekali sahaja';
end $$;
update companies set trial_ends_at = now() - interval '15 days' where code = 'XYZ';
do $$ begin
  perform billing_tick();
  assert (select billing_status from companies where code = 'XYZ') = 'readonly', 'readonly';
  begin
    insert into approval_requests(company_id, request_type, reference_id, requester_employment_id, requester_person_id, title, status)
    values ('00000000-0000-0000-0000-0000000000c2', 'leave', gen_random_uuid(), '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000003', 'x', 'pending');
    raise exception 'patut gagal';
  exception when others then assert sqlerrm like 'Langganan syarikat telah tamat%', 'permohonan disekat: ' || sqlerrm; end;
end $$;

\echo '=== L7: status & kecualikan oleh Pentadbir Platform ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ declare s jsonb; begin
  s := billing_status('00000000-0000-0000-0000-0000000000c2');
  assert s->>'status' = 'readonly' and (s->>'can_pay')::boolean, 'status readonly, boleh bayar';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a004';
select sa_billing_set('00000000-0000-0000-0000-0000000000c2', 'exempt');
do $$ begin
  assert (select billing_status from companies where code = 'XYZ') = 'exempt', 'dikecualikan';
  assert (select count(*) from sa_billing_overview()) = 2, 'gambaran keseluruhan';
end $$;
reset test.uid; reset test.role;
\echo 'SELESAI: langganan'
