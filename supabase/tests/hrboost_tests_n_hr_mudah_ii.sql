\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian HR mudah II: kerja lebih masa → gaji, kalendar pasukan, surat, pengumuman.
insert into companies(id,code,name,address) values ('00000000-0000-0000-0000-0000000000c1','MTB','MTB SDN BHD','D-G-6 Putra Walk');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','LILY BINTI HR','Lily','60110000002','900101145555'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUERIN','Zuerin','60110000003',null),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505105555'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000a005','FARAH','Farah','60110000005',null);
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Operasi','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','Kewangan',null);
insert into employments(id,person_id,company_id,employee_no,status,join_date,department_id) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001','active','2020-01-01','00000000-0000-0000-0000-0000000000d2'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','active','2020-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','active','2024-01-01','00000000-0000-0000-0000-0000000000d1'),
 ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','MTB004','active','2024-01-01','00000000-0000-0000-0000-0000000000d2');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');
insert into employment_compensation(employment_id, component_id, amount, effective_from)
select '00000000-0000-0000-0000-0000000000e4', id, 2600, '2024-01-01' from pay_components where company_id='00000000-0000-0000-0000-0000000000c1' and code='BASIC';

\echo '=== N1: kerja lebih masa — pilihan syarikat (lalai: tidak digunakan) ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
\set ON_ERROR_STOP 0
select submit_overtime('00000000-0000-0000-0000-0000000000e4', current_date - 3, 4, 'normal', 'Sebelum dihidupkan');
select set_overtime_enabled('00000000-0000-0000-0000-0000000000c1', true);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select set_overtime_enabled('00000000-0000-0000-0000-0000000000c1', true);
set test.uid='00000000-0000-0000-0000-00000000a004';
select hours, day_type, status from submit_overtime('00000000-0000-0000-0000-0000000000e4', current_date - 3, 4, 'normal', 'Sambut kumpulan pelancong lewat malam');
select hours, day_type, status from submit_overtime('00000000-0000-0000-0000-0000000000e4', current_date - 2, 3, 'holiday', 'Bertugas cuti umum');
\set ON_ERROR_STOP 0
select submit_overtime('00000000-0000-0000-0000-0000000000e4', current_date + 1, 2, 'normal', 'Masa depan');
select submit_overtime('00000000-0000-0000-0000-0000000000e4', current_date - 3, 2, 'normal', 'Pendua');
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a003';
select (approval_act(t.id, 'approve')).status from approval_tasks t join approval_requests r on r.id = t.request_id
 where r.request_type = 'overtime' and t.status = 'pending' order by r.submitted_at;
reset test.role; reset test.uid;
select work_date = current_date - 3 as hari1, status, amount from overtime_requests order by work_date;
-- 2600/26/8 = 12.50 sejam; 4 j × 1.5 = 75.00; 3 j × 3 = 112.50

\echo '=== N2: gaji — OT diluluskan dimasukkan sebagai pelarasan ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select payroll_prepare('00000000-0000-0000-0000-0000000000c1', extract(year from current_date - 2)::int, extract(month from current_date - 2)::int) is not null as sedia;
select payroll_calculate((select id from payroll_runs limit 1)) is not null as dikira;
reset test.role; reset test.uid;
select l.component_code, l.amount from payslip_lines l join payslips s on s.id = l.payslip_id
 where s.employment_id = '00000000-0000-0000-0000-0000000000e4' and l.component_code in ('BASIC','OT_LULUS') order by 1;
select count(*) as ot_terikat from overtime_requests where paid_via_payroll_run is not null;

\echo '=== N3: kalendar pasukan ==='
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status, reason)
select '00000000-0000-0000-0000-0000000000e4', id, current_date + 5, current_date + 6, 2, 'approved', 'Bercuti' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='MC';
insert into leave_requests(employment_id, leave_type_id, start_date, end_date, days, status, reason)
select '00000000-0000-0000-0000-0000000000e5', id, current_date + 5, current_date + 5, 1, 'approved', 'Bercuti' from leave_types where company_id='00000000-0000-0000-0000-0000000000c1' and code='AL';
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select jsonb_array_length(c->'leave') as cuti_hr, c->'leave'->0->>'type' is not null as hr_nampak_jenis, (c->>'full')::boolean as penuh
  from team_calendar('00000000-0000-0000-0000-0000000000c1', current_date, current_date + 30) c;
set test.uid='00000000-0000-0000-0000-00000000a003';
select jsonb_array_length(c->'leave') as cuti_ketua, c->'leave'->0->>'type_name' as label, c->'leave'->0->>'type' as jenis
  from team_calendar('00000000-0000-0000-0000-0000000000c1', current_date, current_date + 30) c;

\echo '=== N4: surat ==='
set test.uid='00000000-0000-0000-0000-00000000a004';
select request_letter('00000000-0000-0000-0000-0000000000e4', 'salary', 'Permohonan pinjaman perumahan', 'Maybank Berhad') is not null as dimohon;
\set ON_ERROR_STOP 0
select issue_letter((select id from letter_requests limit 1));
select letter_view((select id from letter_requests limit 1));
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select name, kind, status from letter_list('00000000-0000-0000-0000-0000000000c1');
select issue_letter((select id from letter_requests limit 1)) as rujukan;
set test.uid='00000000-0000-0000-0000-00000000a004';
select v->>'full_name' nama, v->>'basic' gaji, v->'company'->>'address' alamat, v->'signatory'->>'name' penandatangan
  from letter_view((select id from letter_requests limit 1)) v;
reset test.role; reset test.uid;
select resource from data_access_log where resource = 'salary_letter';

\echo '=== N5: pengumuman ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a002';
select post_announcement('00000000-0000-0000-0000-0000000000c1', 'Cuti umum ganti', 'Isnin 10 Nov ialah cuti umum ganti.', true) is not null as disiar;
reset test.role; reset test.uid;
select count(*) as whatsapp from notifications where message like 'Pengumuman MTB%';
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select title, is_read, read_count from company_announcements('00000000-0000-0000-0000-0000000000c1');
select mark_announcement_read((select id from announcements limit 1));
\set ON_ERROR_STOP 0
select post_announcement('00000000-0000-0000-0000-0000000000c1', 'Cuba', 'Bukan HR', false);
\set ON_ERROR_STOP 1
set test.uid='00000000-0000-0000-0000-00000000a002';
select title, is_read, read_count, audience from company_announcements('00000000-0000-0000-0000-0000000000c1');
select name from announcement_unread((select id from announcements limit 1));
