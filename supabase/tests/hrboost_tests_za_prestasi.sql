\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian penilaian prestasi & KPI: kitaran → kendiri → pelulus → HR muktamad; privasi markah pelulus.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,6) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUERIN','Zuerin','60110000003','880303-14-0003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','SADAM','Sadam','60110000005','800505-14-0005'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','FARAH','Farah','60110000006','960606-14-0006');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,department_id,manager_person_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,null,'active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1',null,'active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000003','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005',null,null,'active','2015-01-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB006','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000003','active','2025-05-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','ceo');

\echo '=== P1: HR cipta & buka kitaran dengan 2 KPI ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
create temp table _k as select hr_appraisal_cycle_save('00000000-0000-0000-0000-0000000000c1', '{
  "name":"Prestasi 2026","period_start":"2026-01-01","period_end":"2026-12-31","self_due":"2026-12-10","manager_due":"2026-12-20",
  "template":[{"title":"Jualan pakej","target":"RM500k","weight":3},{"title":"Kepuasan pelanggan","target":"4.5/5","weight":1},{"title":"  "}]}'::jsonb) as id;
select hr_appraisal_cycle_open((select id from _k)) as dibuka;
select name, department, reviewer, status from hr_appraisal_list((select id from _k));
do $$ begin
  assert (select count(*) from hr_appraisal_list((select id from _k))) = 5, '5 pekerja';
  assert (select reviewer from hr_appraisal_list((select id from _k)) where name = 'Amin') = 'Zuerin', 'pekerja: pelulus = ketua jabatan';
  assert (select reviewer from hr_appraisal_list((select id from _k)) where name = 'Zuerin') = 'Sadam', 'ketua jabatan: pelulus = CEO';
  assert (select reviewer is null and reviewer_skip from hr_appraisal_list((select id from _k)) where name = 'Sadam'), 'CEO: tiada pelulus';
  assert (select needs_reviewer from hr_appraisal_list((select id from _k)) where name = 'Lily'), 'tiada ketua jabatan: HR perlu tetapkan pelulus';
  assert (select count(*) from appraisal_items i join appraisals a on a.id = i.appraisal_id where a.employment_id = '00000000-0000-0000-0000-0000000000e4') = 2, 'KPI kosong dibuang';
end $$;
create temp table _a as select id from appraisals where employment_id = '00000000-0000-0000-0000-0000000000e4';
grant select on _k, _a to public;

\echo '=== P2: HR tambah KPI; Amin tidak boleh ubah KPI; markah kendiri & hantar ==='
select appraisal_set_items((select id from _a), (select jsonb_agg(jsonb_build_object('id', i->>'id', 'title', i->>'title', 'weight', i->>'weight', 'target', i->>'target'))
                                                   from jsonb_array_elements(appraisal_detail((select id from _a))->'items') i)
                                                 || '[{"title":"Latihan produk baharu","weight":1}]'::jsonb);
set test.uid='00000000-0000-0000-0000-00000000a004';
select id, role, cycle_name, status from my_appraisals('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  begin
    perform appraisal_set_items((select id from _a), '[{"title":"KPI saya sendiri","weight":1}]'::jsonb);
    raise exception 'pekerja sepatutnya tidak boleh ubah KPI';
  exception when others then
    if sqlerrm not like 'Hanya HR boleh mengubah KPI%' then raise; end if;
  end;
  assert (select count(*) from appraisal_items where appraisal_id = (select id from _a)) = 3, 'KPI HR kekal';
end $$;
\set ON_ERROR_STOP 0
select appraisal_self_save((select id from _a), '[]', 'Tahun baik', true);   -- belum beri markah
select appraisal_manager_save((select id from _a), '[]', 'x', false);       -- pekerja bukan pelulus
\set ON_ERROR_STOP 1
select appraisal_self_save((select id from _a),
  (select jsonb_agg(jsonb_build_object('id', i->>'id', 'score', 4, 'note', 'Capai sasaran')) from jsonb_array_elements(appraisal_detail((select id from _a))->'items') i),
  'Tahun yang baik', true);
do $$ begin assert (select status from appraisals where id = (select id from _a)) = 'manager', 'kepada pelulus'; end $$;

\echo '=== P3: Farah tidak boleh melihat penilaian Amin ==='
set test.uid='00000000-0000-0000-0000-00000000a006';
\set ON_ERROR_STOP 0
select appraisal_detail((select id from _a));
\set ON_ERROR_STOP 1

\echo '=== P4: Zuerin (ketua) menilai ==='
set test.uid='00000000-0000-0000-0000-00000000a003';
select role, employee, status from my_appraisals('00000000-0000-0000-0000-0000000000c1') where role = 'reviewer' and employee = 'Amin';
select appraisal_manager_save((select id from _a),
  (select jsonb_agg(jsonb_build_object('id', i->>'id', 'score', case when i->>'title' = 'Jualan pakej' then 5 else 3 end)) from jsonb_array_elements(appraisal_detail((select id from _a))->'items') i),
  'Prestasi jualan cemerlang', true);
do $$ begin
  -- (5*3 + 3*1 + 3*1) / 5 = 4.2
  assert (select manager_rating from appraisals where id = (select id from _a)) = 4.20, 'purata berwajaran';
  assert (select status from appraisals where id = (select id from _a)) = 'hr', 'kepada HR';
end $$;

\echo '=== P5: Amin belum nampak markah pelulus ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
do $$ begin
  assert appraisal_detail((select id from _a))->'manager_rating' = 'null'::jsonb, 'markah pelulus tersembunyi';
  assert (select count(*) from jsonb_array_elements(appraisal_detail((select id from _a))->'items') i where i->'manager_score' <> 'null'::jsonb) = 0, 'markah KPI pelulus tersembunyi';
end $$;

\echo '=== P6: HR muktamad → Amin nampak keputusan ==='
set test.uid='00000000-0000-0000-0000-00000000a002';
select hr_appraisal_finalise((select id from _a), null, 'Dicadangkan kenaikan gaji');
set test.uid='00000000-0000-0000-0000-00000000a004';
select appraisal_detail((select id from _a))->>'final_rating' as akhir, appraisal_detail((select id from _a))->>'manager_comment' as ulasan;
do $$ begin
  assert (appraisal_detail((select id from _a))->>'final_rating')::numeric = 4.20, 'akhir = pelulus';
end $$;

\echo '=== P7: ketua → CEO; jabatan tanpa ketua → HR tetapkan pelulus; HR tidak muktamadkan diri sendiri ==='
create temp table _l as select id from appraisals where employment_id = '00000000-0000-0000-0000-0000000000e2';
grant select on _l to public;
set test.uid='00000000-0000-0000-0000-00000000a002';
select appraisal_self_save((select id from _l),
  (select jsonb_agg(jsonb_build_object('id', i->>'id', 'score', 4)) from jsonb_array_elements(appraisal_detail((select id from _l))->'items') i), 'ok', true);
do $$ begin
  assert (select status from appraisals where id = (select id from _l)) = 'manager', 'tanpa pelulus: menunggu pelulus (bukan terus ke HR)';
  assert (appraisal_detail((select id from _l))->>'needs_reviewer')::boolean, 'perlu pelulus';
end $$;
select hr_appraisal_set_reviewer((select id from _l), '00000000-0000-0000-0000-000000000005');
do $$ begin
  assert (select reviewer_person_id from appraisals where id = (select id from _l)) = '00000000-0000-0000-0000-000000000005', 'pelulus ditetapkan';
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000005' and message ~ '^Lily (telah menghantar penilaian kendiri|has submitted a self-assessment)') = 1, 'pelulus baharu dimaklumkan';
end $$;
set test.uid='00000000-0000-0000-0000-00000000a005';
select role, employee, status from my_appraisals('00000000-0000-0000-0000-0000000000c1') where role = 'reviewer';
do $$ begin
  assert (select count(*) from my_appraisals('00000000-0000-0000-0000-0000000000c1') where role = 'reviewer') = 2, 'CEO menilai Zuerin & Lily';
end $$;
select appraisal_manager_save((select id from _l),
  (select jsonb_agg(jsonb_build_object('id', i->>'id', 'score', 4)) from jsonb_array_elements(appraisal_detail((select id from _l))->'items') i), 'baik', true);
set test.uid='00000000-0000-0000-0000-00000000a002';
do $$ begin
  begin
    perform hr_appraisal_finalise((select id from _l), null, null);
    raise exception 'HR sepatutnya tidak boleh muktamadkan diri sendiri';
  exception when others then
    if sqlerrm not like 'Anda tidak boleh memuktamadkan%' then raise; end if;
  end;
end $$;
set test.uid='00000000-0000-0000-0000-00000000a005';
select hr_appraisal_finalise((select id from _l), null, null);
do $$ begin assert (select status from appraisals where id = (select id from _l)) = 'final', 'CEO muktamadkan penilaian HR'; end $$;

reset test.uid; reset test.role;
select person_id, left(message, 70) from notifications order by created_at;
do $$ begin
  assert (select count(*) from notifications where person_id = '00000000-0000-0000-0000-000000000004' and message ~ 'Prestasi 2026.*(dimuktamadkan|finalised)') = 1, 'Amin dimaklumkan';
  assert translate_message('Penilaian prestasi Prestasi 2026 anda telah dimuktamadkan. Lihat keputusan di HRBoost → Saya → Penilaian prestasi.', 'en')
         like 'Your performance review Prestasi 2026 has been finalised.%', 'terjemahan';
end $$;
