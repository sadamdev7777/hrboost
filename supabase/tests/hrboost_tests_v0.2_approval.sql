\set ON_ERROR_STOP 1
\pset pager off
-- syarikat
insert into companies(id,code,name,accounting_system) values
 ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD','quickbooks'),
 ('00000000-0000-0000-0000-0000000000c2','DOIT','DO IT GROUP SDN BHD','niagawan');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c2');
-- orang: 1 CEO, 2 HR, 3 Zuerin ketua Tour, 4 Amin staff Tour, 5 Finance, 6 HR kedua
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,6) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000a001','Mohd Saddam','Sadam','60110000001'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR Satu','Lily','60110000002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','Zuerin','Zuerin','60110000003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','Amin','Amin','60110000004'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','Finance','Fin','60110000005'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-00000000a006','HR Dua','Ana','60110000006');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','CEO Office','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c2','IT','00000000-0000-0000-0000-000000000001');
insert into employments(id,person_id,company_id,employee_no,department_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','MTB001','00000000-0000-0000-0000-0000000000d2','active','2015-01-01'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d2','active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB004','00000000-0000-0000-0000-0000000000d1','active','2025-03-01'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB005','00000000-0000-0000-0000-0000000000d2','active','2021-01-01'),
 ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','MTB006','00000000-0000-0000-0000-0000000000d2','active','2022-01-01'),
 -- Amin juga kerja di DO IT GROUP (gaji asing)
 ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c2','DOIT001','00000000-0000-0000-0000-0000000000d3','active','2026-01-01');
insert into user_roles(person_id,company_id,role) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','ceo'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','hr'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','finance');
insert into public_holidays(holiday_date,name) values ('2026-12-25','Krismas');

\echo '=== UJIAN 1: Amin mohon cuti 23-28 Dis (ada Krismas + hujung minggu) via WhatsApp agent ==='
set test.role = 'service_role';
select days, status from submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2026-12-23','2026-12-28','full','Balik kampung',null,'whatsapp','00000000-0000-0000-0000-000000000004');
select r.title, r.status, r.current_step_order, r.sla_due_at at time zone 'Asia/Kuala_Lumpur' as sla_myt from approval_requests r;
select step_name, (select full_name from persons where id=approver_person_id), status from approval_tasks order by created_at;
select available, pending, used from leave_balances where employment_id='00000000-0000-0000-0000-0000000000e4';

\echo '--- Zuerin lulus (tier 1) dari WhatsApp'
select status from approval_act((select id from approval_tasks where status='pending' and approver_person_id='00000000-0000-0000-0000-000000000003'),'approve',null,'whatsapp','00000000-0000-0000-0000-000000000003');
\echo '--- Tier HR: dua orang HR, mod any'
select step_name, (select full_name from persons where id=approver_person_id), status from approval_tasks where step_order=2;
\echo '--- Ana (HR) lulus -> Lily superseded, masuk CEO'
select status from approval_act((select id from approval_tasks where status='pending' and approver_person_id='00000000-0000-0000-0000-000000000006'),'approve',null,'web','00000000-0000-0000-0000-000000000006');
select step_order, step_name, (select full_name from persons where id=approver_person_id), status from approval_tasks order by step_order, status;
\echo '--- CEO lulus via login biasa (bukan service role)'
set test.role = 'authenticated'; set test.uid = '00000000-0000-0000-0000-00000000a001';
select status from approval_act((select id from approval_tasks where status='pending'),'approve');
set test.role = 'service_role'; set test.uid = '';
select status from leave_requests;
select available, pending, used from leave_balances where employment_id='00000000-0000-0000-0000-0000000000e4';
select action, step_order, via, comment from approval_actions order by id;

\echo '=== UJIAN 2: Zuerin (ketua) mohon cuti sendiri -> tier 1 dilangkau ==='
select days, status from submit_leave('00000000-0000-0000-0000-0000000000e3','AL','2027-01-04','2027-01-05','full',null,null,'web','00000000-0000-0000-0000-000000000003');
select r.current_step_order, string_agg(t.step_name||':'||p.full_name, ', ') from approval_requests r join approval_tasks t on t.request_id=r.id join persons p on p.id=t.approver_person_id
 where r.requester_person_id='00000000-0000-0000-0000-000000000003' group by 1;

\echo '=== UJIAN 3: HR Lily mohon cuti -> tier HR hanya Ana (Lily dibuang) ==='
-- HR Lily dept head = CEO; delegate: CEO cuti, wakil kepada Zuerin
insert into approval_delegations(company_id,from_person_id,to_person_id,start_date,end_date)
 values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',current_date,current_date+1);
select status from submit_leave('00000000-0000-0000-0000-0000000000e2','AL','2027-02-01','2027-02-01','am',null,null,'web','00000000-0000-0000-0000-000000000002');
select t.step_name, p.full_name, (select full_name from persons where id=t.delegated_from) as wakil_bagi from approval_tasks t join persons p on p.id=t.approver_person_id
 join approval_requests r on r.id=t.request_id where r.requester_person_id='00000000-0000-0000-0000-000000000002';
\echo '--- Tolak tanpa sebab mesti gagal'
\set ON_ERROR_STOP 0
select approval_act((select t.id from approval_tasks t join approval_requests r on r.id=t.request_id where r.requester_person_id='00000000-0000-0000-0000-000000000002' and t.status='pending'),'reject',null,'web','00000000-0000-0000-0000-000000000003');
\echo '--- Bukan approver cuba lulus mesti gagal'
select approval_act((select t.id from approval_tasks t join approval_requests r on r.id=t.request_id where r.requester_person_id='00000000-0000-0000-0000-000000000002' and t.status='pending'),'approve',null,'web','00000000-0000-0000-0000-000000000004');
\echo '--- Baki tak cukup mesti gagal'
select submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2027-03-01','2027-03-31','full',null,null,'web','00000000-0000-0000-0000-000000000004');
\echo '--- Tarikh bertindih mesti gagal'
select submit_leave('00000000-0000-0000-0000-0000000000e4','AL','2026-12-24','2026-12-24','full',null,null,'web','00000000-0000-0000-0000-000000000004');
\set ON_ERROR_STOP 1
select status from approval_act((select t.id from approval_tasks t join approval_requests r on r.id=t.request_id where r.requester_person_id='00000000-0000-0000-0000-000000000002' and t.status='pending'),'reject','Team tak cukup orang','web','00000000-0000-0000-0000-000000000003');
select lr.status, b.pending from leave_requests lr join leave_balances b on b.employment_id=lr.employment_id and b.leave_type_id=lr.leave_type_id where lr.employment_id='00000000-0000-0000-0000-0000000000e2';

\echo '=== UJIAN 4: Claim RM1,250 -> CEO ditambah (syarat > 1000) ==='
insert into claims(id,employment_id,title) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e4','Trip Kundasang');
insert into claim_items(claim_id,claim_type_id,expense_date,amount,receipt_path)
 select '00000000-0000-0000-0000-0000000000f1', id, '2026-11-02', 1250, 'receipts/x.jpg' from claim_types where company_id='00000000-0000-0000-0000-0000000000c1' and name='Grab / Teksi';
select status, total_amount from submit_claim('00000000-0000-0000-0000-0000000000f1','whatsapp','00000000-0000-0000-0000-000000000004');
select approval_act(id,'approve',null,'web',approver_person_id) from approval_tasks where status='pending' and request_id=(select approval_request_id from claims);
select approval_act(id,'approve',null,'web',approver_person_id) from approval_tasks where status='pending' and request_id=(select approval_request_id from claims);
select step_name, status from approval_tasks where request_id=(select approval_request_id from claims) order by step_order;
select approval_act(id,'approve',null,'web',approver_person_id) from approval_tasks where status='pending' and request_id=(select approval_request_id from claims);
select status from claims; select system, entity_type, status from accounting_sync_queue;

\echo '=== UJIAN 5: Kehadiran — Amin lewat (sistem luar) -> WhatsApp ==='
select late_minutes from ingest_attendance('00000000-0000-0000-0000-0000000000c1','MTB004','2026-11-03','2026-11-03 09:25+08',null,'zkteco','z1','{}');
select late_minutes from ingest_attendance('00000000-0000-0000-0000-0000000000c1','MTB004','2026-11-04','2026-11-04 09:40+08',null,'zkteco','z2','{}');
select late_minutes from ingest_attendance('00000000-0000-0000-0000-0000000000c1','MTB004','2026-11-05','2026-11-05 09:05+08',null,'zkteco','z3','{}');
select late_minutes from ingest_attendance('00000000-0000-0000-0000-0000000000c1','MTB004','2026-11-06','2026-11-06 10:02+08',null,'zkteco','z4','{}');
select process_hr_events();
select p.preferred_name as kepada, n.to_address, n.message from notifications n join persons p on p.id=n.person_id
 where n.message ilike '%lewat%' or n.message ilike '%clock-in%' order by n.created_at;
\echo '--- jumlah notifikasi ikut jenis'
select r.name, count(*) from notifications n join automation_rules r on r.id=n.rule_id group by 1 order by 1;

\echo '=== UJIAN 6: RLS — Amin hanya nampak data sendiri ==='
grant usage on schema public to authenticated; grant select on all tables in schema public to authenticated;
set role authenticated; set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select count(*) as employments_amin_nampak from employments;
select count(*) as leave_amin_nampak from leave_requests;
select count(*) as tugasan_saya from v_my_approval_tasks;
select title, status, waiting_for from v_my_requests;
reset role; set test.uid='00000000-0000-0000-0000-00000000a003';
set role authenticated;
select count(*) as employments_zuerin_nampak from employments;
select title from v_my_approval_tasks;
reset role;
