\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian pilih pekerja Lindung 24 Jam (SKBBK) secara pukal.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name,skbbk_default) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD',true);
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,6) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no,nationality,children_count) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002','MY',0),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUERIN','Zuerin','60110000003','880303-14-0003','MY',3),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004','MY',0),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','RAHIM','Rahim','60110000005',null,'BD',0),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','NADIA','Nadia','60110000006','910101-14-0006','MY',0);
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB004','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB005','active','2021-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','finance');

\echo '=== S1: lalai ON — semua menyertai ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select name, foreign_worker, setting, joined from hr_skbbk_list('00000000-0000-0000-0000-0000000000c1');
do $$ begin assert (select count(*) from hr_skbbk_list('00000000-0000-0000-0000-0000000000c1') where joined) = 5, 'semua 5'; end $$;

\echo '=== S2: kecualikan Zuerin & Amin; cuba kecualikan Rahim (asing) ==='
select hr_set_skbbk('00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e6']::uuid[]) as diubah;
select name, setting, joined from hr_skbbk_list('00000000-0000-0000-0000-0000000000c1');
reset test.uid; reset test.role;
do $$ begin
  assert (select skbbk from employment_stat_effective('00000000-0000-0000-0000-0000000000e3', current_date)) = false, 'Zuerin dikecualikan';
  assert (select skbbk from employment_stat_effective('00000000-0000-0000-0000-0000000000e4', current_date)) = false, 'Amin dikecualikan';
  assert (select skbbk from employment_stat_effective('00000000-0000-0000-0000-0000000000e2', current_date)) = true, 'Lily menyertai';
  assert (select skbbk from employment_stat_effective('00000000-0000-0000-0000-0000000000e5', current_date)) = true, 'Rahim (asing) sentiasa menyertai';
  assert (select skbbk from employment_statutory where employment_id = '00000000-0000-0000-0000-0000000000e2') is null, 'Lily kekal auto (tiada rekod baharu)';
  assert (select child_u18 from employment_statutory where employment_id = '00000000-0000-0000-0000-0000000000e3') = 3, 'bilangan anak Zuerin dikekalkan untuk PCB';
  assert (select child_units from employment_stat_effective('00000000-0000-0000-0000-0000000000e3', current_date)) = 3, 'pelepasan anak PCB tidak berubah';
end $$;

\echo '=== S3: Kewangan boleh lihat, tidak boleh ubah ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a006';
select count(*) as boleh_lihat from hr_skbbk_list('00000000-0000-0000-0000-0000000000c1');
\set ON_ERROR_STOP 0
select hr_set_skbbk('00000000-0000-0000-0000-0000000000c1', '{}');
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin assert (select count(*) from hr_skbbk_list('00000000-0000-0000-0000-0000000000c1')) = 0, 'pekerja biasa tiada akses'; end $$;
