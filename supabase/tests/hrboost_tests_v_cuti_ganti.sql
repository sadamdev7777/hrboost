\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian cuti ganti automatik (Akta Kerja s.60D): cuti umum pada hari rehat → hari bekerja berikutnya.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,state,weekend_days) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','Selangor','{0,6}'),
 ('00000000-0000-0000-0000-0000000000c2','KDH','SYARIKAT KEDAH SDN BHD','Kedah','{5,6}');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,3) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ORANG LUAR','Luar','60110000003','880303-14-0003');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01');

-- Sabtu 1 Mac 2031 & Ahad 2 Mac 2031 (dua cuti berturut pada hujung minggu), Ahad 31 Ogos 2031 (Merdeka)
insert into public_holidays(holiday_date,name,is_mandatory) values
 ('2031-03-01','Cuti Ujian A',true),
 ('2031-03-02','Cuti Ujian B',true),
 ('2031-08-31','Hari Kebangsaan',true);

\echo '=== CG1: hari ganti Sabtu/Ahad → Isnin & Selasa ==='
select holiday_date, name, is_replacement, original_date
  from company_holidays_effective('00000000-0000-0000-0000-0000000000c1','2031-03-01','2031-03-07');
do $$ begin
  assert (select array_agg(holiday_date order by holiday_date) from company_holidays_effective('00000000-0000-0000-0000-0000000000c1','2031-03-01','2031-03-07') where is_replacement)
         = array['2031-03-03','2031-03-04']::date[], 'cuti ganti Mac salah';
  assert not is_working_day('00000000-0000-0000-0000-0000000000c1','2031-03-03'), '3 Mac sepatutnya cuti ganti';
  assert not is_working_day('00000000-0000-0000-0000-0000000000c1','2031-03-04'), '4 Mac sepatutnya cuti ganti';
  assert is_working_day('00000000-0000-0000-0000-0000000000c1','2031-03-05'), '5 Mac hari bekerja';
  assert not is_working_day('00000000-0000-0000-0000-0000000000c1','2031-09-01'), '1 Sep cuti ganti Merdeka';
  -- julat sempit yang hanya meliputi hari ganti tetap mengesan cuti asal sebelumnya
  assert exists (select 1 from company_holidays_effective('00000000-0000-0000-0000-0000000000c1','2031-09-01','2031-09-01')
                  where is_replacement and original_date = '2031-08-31'), 'julat sempit';
end $$;

\echo '=== CG2: hujung minggu Jumaat/Sabtu (Kedah) ==='
do $$ begin
  -- Sabtu 1 Mac = hari rehat → Ahad 2 Mac ialah cuti B → ganti jatuh Isnin 3 Mac. Ahad 2 Mac hari bekerja biasa (cuti, tiada ganti).
  assert (select array_agg(holiday_date order by holiday_date) from company_holidays_effective('00000000-0000-0000-0000-0000000000c2','2031-03-01','2031-03-07') where is_replacement)
         = array['2031-03-03']::date[], 'cuti ganti Kedah salah';
  assert is_working_day('00000000-0000-0000-0000-0000000000c2','2031-09-01'), 'Merdeka Ahad bukan hari rehat Kedah';
end $$;

\echo '=== CG3: pilihan syarikat — cuti tidak dipilih tiada ganti ==='
insert into public_holidays(holiday_date,name,is_mandatory) values ('2031-05-03','Cuti Pilihan',false);
insert into company_holiday_choices(company_id,year,holiday_id)
  select '00000000-0000-0000-0000-0000000000c1', 2031, id from public_holidays where is_mandatory and extract(year from holiday_date)=2031;
do $$ begin
  assert is_working_day('00000000-0000-0000-0000-0000000000c1','2031-05-05'), 'cuti tidak dipilih tidak diganti';
end $$;

\echo '=== CG4: paparan untuk ahli sahaja; fungsi dalaman tidak boleh dipanggil ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select holiday_date, name from company_holidays('00000000-0000-0000-0000-0000000000c1','2031-03-01','2031-03-07');
do $$ begin
  assert (select count(*) from company_holidays('00000000-0000-0000-0000-0000000000c1','2031-03-01','2031-03-07')) = 4, 'ahli nampak 4';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a003';
do $$ begin
  assert (select count(*) from company_holidays('00000000-0000-0000-0000-0000000000c1','2031-03-01','2031-03-07')) = 0, 'bukan ahli nampak 0';
end $$;
reset test.uid; reset test.role;
do $$ begin
  assert not has_function_privilege('authenticated','company_holidays_effective(uuid,date,date)','execute'), 'fungsi dalaman terbuka';
end $$;
