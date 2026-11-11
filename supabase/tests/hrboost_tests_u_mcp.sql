\set ON_ERROR_STOP 1
\pset pager off
\pset footer off
-- Ujian Sambungan AI (MCP): token peribadi, alat bertindak sebagai pengguna, semakan peranan, batal token.
-- Gunakan stub local_only (test.uid / test.role). Jangan jalankan pada Supabase sebenar.

insert into companies(id,code,name) values ('00000000-0000-0000-0000-0000000000c1','MTB','MUSLIMTRAVELBUG SDN BHD');
select seed_company_defaults('00000000-0000-0000-0000-0000000000c1');
insert into auth.users select ('00000000-0000-0000-0000-00000000a00'||g)::uuid from generate_series(1,9) g;
insert into persons(id,auth_user_id,full_name,preferred_name,phone_whatsapp,ic_no) values
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000a002','HR SATU','Lily','60110000002','900202-14-0002'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000a003','ZUERIN','Zuerin','60110000003','880303-14-0003'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000a004','AMIN BIN ALI','Amin','60110000004','950505-14-0004');
insert into departments(id,company_id,name,head_person_id) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Tour','00000000-0000-0000-0000-000000000003');
insert into employments(id,person_id,company_id,employee_no,department_id,manager_person_id,status,join_date) values
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','MTB001',null,null,'active','2020-01-01'),
 ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','MTB002','00000000-0000-0000-0000-0000000000d1',null,'active','2019-01-01'),
 ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','MTB003','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000003','active','2025-03-01');
insert into user_roles(person_id,company_id,role) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr');

\echo '=== M1: cipta token ==='
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select (mcp_token_create('00000000-0000-0000-0000-0000000000c1','Claude Amin'))->>'token' as amin \gset
set test.uid='00000000-0000-0000-0000-00000000a003';
select (mcp_token_create('00000000-0000-0000-0000-0000000000c1','Claude Zuerin'))->>'token' as zuerin \gset
set test.uid='00000000-0000-0000-0000-00000000a002';
select (mcp_token_create('00000000-0000-0000-0000-0000000000c1','Claude Lily'))->>'token' as lily \gset
\set ON_ERROR_STOP 0
select mcp_token_create('00000000-0000-0000-0000-0000000000c1', '  ');
\set ON_ERROR_STOP 1
do $$ begin
  assert (select count(*) from mcp_tokens) = 3, '3 token';
  assert not exists (select 1 from mcp_tokens where token_hash like 'hrb_%'), 'hanya hash disimpan';
end $$;

\echo '=== M2: alat sebagai pekerja ==='
set test.uid=''; set test.role='anon';
select mcp_call(:'amin', 'get_my_profile', '{}')->'data'->>'name' as nama;
select mcp_call(:'amin', 'apply_leave', '{"leave_type":"AL","start_date":"2026-12-28","end_date":"2026-12-29","reason":"Urusan keluarga"}') as mohon;
do $$ begin
  assert (select status from leave_requests where employment_id = '00000000-0000-0000-0000-0000000000e4') = 'pending', 'cuti dimohon melalui AI';
  assert (select created_via from leave_requests where employment_id = '00000000-0000-0000-0000-0000000000e4') = 'ai_agent', 'saluran ai_agent';
end $$;
select mcp_call(:'amin', 'search_employees', '{}') as amin_cari_pekerja;
select mcp_call(:'amin', 'list_my_requests', '{}')->'data'->0->>'title' as permohonan;

\echo '=== M3: kelulusan oleh ketua melalui AI ==='
select mcp_call(:'zuerin', 'list_pending_approvals', '{}')->'data'->0->>'task_id' as tugasan \gset
select mcp_call(:'amin', 'decide_approval', format('{"task_id":"%s","decision":"approve"}', :'tugasan')::jsonb) as amin_lulus_sendiri;
select mcp_call(:'zuerin', 'decide_approval', format('{"task_id":"%s","decision":"approve","comment":"OK"}', :'tugasan')::jsonb) as zuerin_lulus;
do $$ begin
  assert (select status from approval_tasks where approver_person_id = '00000000-0000-0000-0000-000000000003') = 'approved', 'ketua meluluskan';
  assert (select acted_via from approval_tasks where approver_person_id = '00000000-0000-0000-0000-000000000003') = 'ai_agent', 'acted_via ai_agent';
end $$;

\echo '=== M4: HR & batal token ==='
select jsonb_array_length(mcp_call(:'lily', 'search_employees', '{}')->'data') as hr_cari;
select mcp_call(:'lily', 'hr_summary', '{}')->'data'->>'active_employees' as aktif;
set test.role='authenticated'; set test.uid='00000000-0000-0000-0000-00000000a004';
select mcp_token_revoke((select id from mcp_tokens where name = 'Claude Amin'));
set test.uid=''; set test.role='anon';
\set ON_ERROR_STOP 0
select mcp_call(:'amin', 'get_my_profile', '{}');
select mcp_call('hrb_palsu', 'get_my_profile', '{}');
\set ON_ERROR_STOP 1
do $$ begin
  assert (select count(*) from mcp_call_log where ok) >= 6, 'panggilan direkodkan';
  assert exists (select 1 from mcp_call_log where not ok and error like 'Hanya HR%'), 'penolakan direkodkan';
end $$;

\echo '=== M9: agent_tool_call (Pembantu AI, service role) — semakan peranan sama seperti MCP ==='
reset test.uid; reset test.role;
do $$ declare r jsonb; begin
  r := agent_tool_call('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','hr_summary','{}');
  assert r ? 'headcount' or r is not null, 'HR dapat ringkasan';
  begin
    perform agent_tool_call('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','hr_summary','{}');
    assert false, 'pekerja biasa tidak boleh hr_summary';
  exception when assert_failure then raise; when others then null;
  end;
  begin
    perform agent_tool_call('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c2','get_my_profile','{}');
    assert false, 'syarikat lain ditolak';
  exception when assert_failure then raise; when others then null;
  end;
end $$;
do $$ begin
  assert not has_function_privilege('authenticated','agent_tool_call(uuid,uuid,text,jsonb)','execute'), 'tidak terbuka kepada pengguna';
end $$;
