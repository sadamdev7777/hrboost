\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian peringkat kelulusan dengan peranan tambahan: gaji — Kewangan ATAU CEO boleh meluluskan peringkat Kewangan.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,5) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','SADAM CEO','Sadam','60110000001','800101-14-0001'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','NADIA','Nadia','60110000005','910101-14-0005');
insert into employments(id,person_id,company_id,employee_no,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB000','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','active','2021-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','finance');

\echo '=== X1: aliran gaji lalai — peringkat Kewangan juga untuk CEO ==='
select s.step_order, s.name, s.approver_role, s.extra_roles from approval_workflow_steps s join approval_workflows w on w.id = s.workflow_id
 where w.company_id = '00000000-0000-0000-0000-0000000000c1' and w.request_type = 'payroll_run' order by s.step_order;
do $$ begin
  assert exists (select 1 from approval_workflow_steps s join approval_workflows w on w.id = s.workflow_id
                  where w.company_id = '00000000-0000-0000-0000-0000000000c1' and w.request_type = 'payroll_run'
                    and s.approver_role = 'finance' and s.extra_roles = '{ceo}'), 'lalai Kewangan + CEO';
end $$;

\echo '=== X2: HR simpan aliran gaji satu peringkat "Kewangan atau CEO" ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select save_workflow('00000000-0000-0000-0000-0000000000c1', 'payroll_run',
  '[{"name":"Kewangan","approver":"role","approver_role":"finance","extra_roles":["ceo","finance","bukan"],"condition":{},"skip_if_requester":true}]');
reset test.uid; reset test.role;
do $$ begin
  assert (select s.extra_roles from approval_workflow_steps s join approval_workflows w on w.id = s.workflow_id
           where w.company_id = '00000000-0000-0000-0000-0000000000c1' and w.request_type = 'payroll_run') = '{ceo}', 'hanya peranan sah, tanpa pendua';
end $$;

\echo '=== X3: gaji dihantar oleh HR → tugasan untuk Nadia (Kewangan) DAN Sadam (CEO); seorang sudah memadai ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
create temp table _r as select (payroll_prepare('00000000-0000-0000-0000-0000000000c1', 2026, 10)->>'run_id')::uuid as id;
grant select on _r to public;
select payroll_calculate((select id from _r)) is not null as dikira;
select (submit_payroll_run((select id from _r))).status;
reset test.uid; reset test.role;
select coalesce(p.preferred_name, p.full_name) pelulus, t.step_name, t.status from approval_tasks t join persons p on p.id = t.approver_person_id
 where t.request_id = (select approval_request_id from payroll_runs where id = (select id from _r)) order by 1;
do $$ begin
  assert (select count(*) from approval_tasks where request_id = (select approval_request_id from payroll_runs where id = (select id from _r)) and status = 'pending') = 2, 'Nadia & Sadam';
end $$;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a001';
select (approval_act((select id from approval_tasks where approver_person_id = '00000000-0000-0000-0000-000000000001'
         and request_id = (select approval_request_id from payroll_runs where id = (select id from _r))), 'approve', null, 'web')).status;
reset test.uid; reset test.role;
do $$ begin
  assert (select status from payroll_runs where id = (select id from _r)) = 'approved', 'CEO meluluskan peringkat Kewangan';
  assert not exists (select 1 from approval_tasks where request_id = (select approval_request_id from payroll_runs where id = (select id from _r)) and status = 'pending'), 'tugasan Nadia ditutup';
end $$;
