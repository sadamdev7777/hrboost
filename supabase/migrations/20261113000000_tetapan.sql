-- =====================================================================
--  Fasa D3: Tetapan syarikat (Tetapan dan sub-skrin), Akses Syarikat
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pentadbir hanya boleh mengubah profil & waktu kerja syarikat — bukan status,
--    had WhatsApp/AI, kod atau pemilik (dikawal Pentadbir Platform melalui RPC sa_*).
-- ---------------------------------------------------------------------
alter table companies add column if not exists claim_submit_days int check (claim_submit_days between 1 and 365);
-- Kadar caruman KWSP majikan pilihan syarikat (NULL = minimum berkanun)
alter table companies add column if not exists epf_employer_rate numeric(5,2) check (epf_employer_rate between 0 and 30);

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke insert, update, delete on companies from authenticated;
    grant update (name, reg_no, state, weekend_days, work_start, work_end, late_grace_minutes,
                  epf_employer_no, socso_employer_no, lhdn_employer_no, hrdf_registered,
                  accounting_system, accounting_config, logo_path, claim_submit_days, epf_employer_rate)
      on companies to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tuntutan mesti dihantar dalam tempoh yang ditetapkan syarikat (tarikh resit)
-- ---------------------------------------------------------------------
create or replace function trg_claim_submit_window() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; tua date;
begin
  if new.status = 'pending' and old.status in ('draft','returned') then
    select c.claim_submit_days into lim from employments e join companies c on c.id = e.company_id
     where e.id = new.employment_id;
    if lim is not null then
      select min(expense_date) into tua from claim_items where claim_id = new.id;
      if tua < (now() at time zone 'Asia/Kuala_Lumpur')::date - lim then
        raise exception 'Tuntutan mesti dihantar dalam tempoh % hari selepas tarikh resit', lim;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists claim_submit_window on claims;
create trigger claim_submit_window before update of status on claims
  for each row execute function trg_claim_submit_window();

-- ---------------------------------------------------------------------
-- 3. Kelayakan cuti tidak boleh kurang daripada minimum Akta Kerja 1955
-- ---------------------------------------------------------------------
create or replace function statutory_leave_minimum(p_code text, p_min_service_months int) returns numeric
language sql immutable as $$
  select case p_code
    when 'AL' then case when coalesce(p_min_service_months,0) < 24 then 8 when p_min_service_months < 60 then 12 else 16 end
    when 'MC' then case when coalesce(p_min_service_months,0) < 24 then 14 when p_min_service_months < 60 then 18 else 22 end
    when 'HL' then 60 when 'ML' then 98 when 'PL' then 7 else 0 end
$$;

create or replace function trg_leave_entitlement_min() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text; m numeric;
begin
  select code into c from leave_types where id = new.leave_type_id;
  m := statutory_leave_minimum(c, new.min_service_months);
  if new.days_per_year < m then
    raise exception 'Kelayakan tidak boleh kurang daripada minimum Akta Kerja (% hari)', m;
  end if;
  return new;
end $$;
drop trigger if exists leave_entitlement_min on leave_entitlement_rules;
create trigger leave_entitlement_min before insert or update on leave_entitlement_rules
  for each row execute function trg_leave_entitlement_min();

-- Jenis cuti wajib tidak boleh dinyahaktifkan atau dipadam
create or replace function trg_leave_type_statutory() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.code in ('AL','MC','HL','ML','PL') then raise exception 'Jenis cuti wajib tidak boleh dipadam'; end if;
    return old;
  end if;
  if old.code in ('AL','MC','HL','ML','PL') and (not new.active or new.code <> old.code) then
    raise exception 'Jenis cuti wajib tidak boleh dimatikan';
  end if;
  return new;
end $$;
drop trigger if exists leave_type_statutory on leave_types;
create trigger leave_type_statutory before update or delete on leave_types
  for each row execute function trg_leave_type_statutory();

-- ---------------------------------------------------------------------
-- 4. Simpan aliran kelulusan secara atomik (skrin AliranApproval)
--    p_steps: [{name, approver:'dept_head'|'role'|'specific_person', approver_role, approver_person_id,
--               condition:{field,op,value} | {}, skip_if_requester}]
-- ---------------------------------------------------------------------
create or replace function save_workflow(p_company uuid, p_type request_type, p_steps jsonb,
                                         p_cutoff time default null, p_reminder_hours int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare wf uuid; s jsonb; i int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'Sekurang-kurangnya satu peringkat diperlukan (tiada kelulusan automatik)';
  end if;
  if jsonb_array_length(p_steps) > 6 then raise exception 'Maksimum 6 peringkat'; end if;
  if p_reminder_hours is not null and p_reminder_hours not between 1 and 24 then raise exception 'Peringatan tidak sah'; end if;

  select id into wf from approval_workflows where company_id = p_company and request_type = p_type;
  if wf is null then
    insert into approval_workflows(company_id, request_type, name)
    values (p_company, p_type, 'Kelulusan ' || p_type) returning id into wf;
  end if;
  update approval_workflows set cutoff_time = coalesce(p_cutoff, cutoff_time),
         reminder_every_hours = coalesce(p_reminder_hours, reminder_every_hours)
   where id = wf;

  delete from approval_workflow_steps where workflow_id = wf;
  for s in select * from jsonb_array_elements(p_steps) loop
    i := i + 1;
    if coalesce(trim(s->>'name'), '') = '' then raise exception 'Peringkat % tiada nama', i; end if;
    if (s->>'approver') = 'specific_person' and not exists (
        select 1 from employments e where e.person_id = (s->>'approver_person_id')::uuid
           and e.company_id = p_company and e.status in ('probation','active')) then
      raise exception 'Pelulus peringkat % mesti pekerja syarikat ini', i;
    end if;
    insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role, approver_person_id,
                                        condition, skip_if_requester)
    values (wf, i, trim(s->>'name'), (s->>'approver')::approver_type,
            nullif(s->>'approver_role', '')::app_role, nullif(s->>'approver_person_id', '')::uuid,
            coalesce(s->'condition', '{}'), coalesce((s->>'skip_if_requester')::boolean, true));
  end loop;
  perform emit_event(p_company, 'settings.workflow_changed', current_person_id(), null,
                     jsonb_build_object('request_type', p_type, 'steps', i));
  return wf;
end $$;

-- ---------------------------------------------------------------------
-- 5. Wakil kelulusan automatik: apabila pelulus memohon cuti dan menamakan
--    pengganti tugas, wakil dicipta untuk tempoh cuti itu (reka bentuk T_WakilKelulusan).
-- ---------------------------------------------------------------------
create or replace function trg_leave_auto_delegate() returns trigger
language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  if new.status = 'pending' and coalesce(old.status::text, '') <> 'pending' and new.cover_person_id is not null then
    select * into e from employments where id = new.employment_id;
    -- hanya jika pemohon ialah pelulus (ketua jabatan atau peranan pelulus) dalam syarikat ini
    if exists (select 1 from departments where company_id = e.company_id and head_person_id = e.person_id)
       or exists (select 1 from user_roles where company_id = e.company_id and person_id = e.person_id
                   and role in ('hr','finance','ceo')) then
      if not exists (select 1 from approval_delegations where company_id = e.company_id
                      and from_person_id = e.person_id and to_person_id = new.cover_person_id
                      and start_date = new.start_date and end_date = new.end_date) then
        insert into approval_delegations(company_id, from_person_id, to_person_id, start_date, end_date, request_types)
        values (e.company_id, e.person_id, new.cover_person_id, new.start_date, new.end_date,
                '{leave,claim,attendance_correction}');
      end if;
    end if;
  end if;
  if new.status in ('rejected','cancelled') and old.status = 'pending' then
    delete from approval_delegations d using employments em
     where em.id = new.employment_id and d.company_id = em.company_id and d.from_person_id = em.person_id
       and d.to_person_id = new.cover_person_id and d.start_date = new.start_date and d.end_date = new.end_date;
  end if;
  return new;
end $$;
drop trigger if exists leave_auto_delegate on leave_requests;
create trigger leave_auto_delegate after insert or update of status on leave_requests
  for each row execute function trg_leave_auto_delegate();

-- Wakil mesti rakan sesyarikat
create or replace function trg_delegation_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from employments where person_id = new.to_person_id and company_id = new.company_id
                  and status in ('probation','active')) then
    raise exception 'Wakil mesti pekerja syarikat ini';
  end if;
  return new;
end $$;
drop trigger if exists delegation_check on approval_delegations;
create trigger delegation_check before insert or update on approval_delegations
  for each row execute function trg_delegation_check();

-- ---------------------------------------------------------------------
-- 6. Senarai untuk skrin Tetapan
-- ---------------------------------------------------------------------
-- Cuti umum bagi tahun & negeri syarikat, dengan status pilihan (CutiUmum)
create or replace function company_holiday_options(p_company uuid, p_year int)
returns table(id uuid, holiday_date date, name text, is_mandatory boolean, is_adhoc boolean, chosen boolean)
language sql stable security definer set search_path = public as $$
  select h.id, h.holiday_date, h.name, h.is_mandatory, h.is_adhoc,
         h.is_mandatory or h.is_adhoc
           or not exists (select 1 from company_holiday_choices x where x.company_id = c.id and x.year = p_year)
           or exists (select 1 from company_holiday_choices x where x.company_id = c.id and x.holiday_id = h.id)
    from companies c join public_holidays h
      on extract(year from h.holiday_date) = p_year
     and (h.company_id is null or h.company_id = c.id)
     and (h.state is null or h.state = c.state)
   where c.id = p_company and is_company_member(p_company)
   order by h.holiday_date
$$;

-- Ringkasan untuk menu Tetapan
create or replace function settings_summary(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when has_role(p_company, '{hr,finance,ceo,admin}') then jsonb_build_object(
    'workflows', (select count(*) from approval_workflows where company_id = p_company and active),
    'delegations_active', (select count(*) from approval_delegations where company_id = p_company
                            and end_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date),
    'automations', (select count(*) from automation_rules where company_id = p_company and active),
    'holidays', (select count(*) from company_holiday_options(p_company, extract(year from now())::int) where chosen),
    'state', (select state from companies where id = p_company),
    'work_start', (select to_char(work_start, 'FMHH24:MI') from companies where id = p_company),
    'grace', (select late_grace_minutes from companies where id = p_company),
    'accounting', (select accounting_system from companies where id = p_company),
    'code', (select code from companies where id = p_company),
    'kb_docs', (select count(*) from ai_knowledge_docs where company_id = p_company and active),
    'attendance', (select count(*) > 0 from integration_keys where company_id = p_company)
  ) end
$$;

-- Akses dari luar syarikat (T_Pengguna): nama pemohon & syarikat asal untuk Pentadbir sasaran
create or replace function company_external_access(p_company uuid)
returns table(id uuid, name text, home_company text, role app_role, status text, reason text, days int,
              expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, coalesce(p.preferred_name, p.full_name),
         (select string_agg(distinct c.code, ', ') from employments e join companies c on c.id = e.company_id
           where e.person_id = g.person_id and e.status in ('probation','active')),
         g.role, g.status, g.reason, g.days, g.expires_at, g.created_at
    from company_access_grants g join persons p on p.id = g.person_id
   where g.company_id = p_company and has_role(p_company, '{admin}')
     and (g.status = 'pending' or (g.status = 'approved' and coalesce(g.expires_at, now()) >= now()))
   order by g.created_at desc
$$;

-- Permohonan akses saya (AksesSyarikat)
create or replace function my_access_requests()
returns table(id uuid, company_code text, company_name text, role app_role, days int, status text,
              expires_at timestamptz, decision_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, c.code, c.name, g.role, g.days, g.status, g.expires_at, g.decision_note, g.created_at
    from company_access_grants g join companies c on c.id = g.company_id
   where g.person_id = current_person_id()
   order by g.created_at desc limit 20
$$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'company_external_access(uuid)', 'my_access_requests()',
    'save_workflow(uuid, request_type, jsonb, time, int)', 'company_holiday_options(uuid, int)',
    'settings_summary(uuid)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  foreach f in array array['trg_claim_submit_window()', 'trg_leave_entitlement_min()', 'trg_leave_type_statutory()',
                           'trg_leave_auto_delegate()', 'trg_delegation_check()'] loop
    execute format('revoke execute on function %s from public', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Teks lalai dalam bahasa Melayu rasmi (CLAUDE.md: pekerja, pengganti tugas, Kewangan)
-- ---------------------------------------------------------------------
create or replace function seed_company_defaults(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lt uuid; wf uuid;
begin
  -- jenis cuti
  insert into leave_types(company_id, code, name, sort_order) values (p_company,'AL','Cuti Tahunan',1) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, min_service_months, max_service_months, days_per_year)
  values (lt,0,24,8),(lt,24,60,12),(lt,60,null,16);
  update leave_types set max_carry_forward = 5 where id = lt;

  insert into leave_types(company_id, code, name, requires_attachment, sla_exempt, allow_backdate, sort_order)
  values (p_company,'MC','Cuti Sakit',true,true,true,2) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, min_service_months, max_service_months, days_per_year)
  values (lt,0,24,14),(lt,24,60,18),(lt,60,null,22);

  insert into leave_types(company_id, code, name, requires_attachment, sla_exempt, allow_backdate, sort_order)
  values (p_company,'HL','Cuti Hospitalisasi',true,true,true,3) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,60);

  insert into leave_types(company_id, code, name, eligible_gender, sort_order)
  values (p_company,'ML','Cuti Bersalin','P',4) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,98);

  insert into leave_types(company_id, code, name, eligible_gender, sort_order)
  values (p_company,'PL','Cuti Paterniti','L',5) returning id into lt;
  insert into leave_entitlement_rules(leave_type_id, days_per_year) values (lt,7);

  insert into leave_types(company_id, code, name, deduct_balance, sla_exempt, allow_backdate, sort_order)
  values (p_company,'EL','Cuti Kecemasan',false,true,true,6);
  insert into leave_types(company_id, code, name, is_paid, deduct_balance, sort_order)
  values (p_company,'UL','Cuti Tanpa Gaji',false,false,7);

  -- aliran kelulusan
  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'leave','Kelulusan Cuti','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values
    (wf,1,'Ketua Jabatan','dept_head',null),
    (wf,2,'HR','role','hr'),
    (wf,3,'CEO','role','ceo');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'claim','Kelulusan Tuntutan','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role, condition) values
    (wf,1,'Ketua Jabatan','dept_head',null,'{}'),
    (wf,2,'Kewangan','role','finance','{}'),
    (wf,3,'CEO','role','ceo','{"field":"amount","op":">","value":1000}');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'attendance_correction','Pembetulan Kehadiran','same_day') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver) values
    (wf,1,'Ketua Jabatan','dept_head');

  insert into approval_workflows(company_id, request_type, name, sla)
  values (p_company,'payroll_run','Kelulusan Gaji','none') returning id into wf;
  insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values
    (wf,1,'Kewangan','role','finance'),
    (wf,2,'CEO','role','ceo');

  -- jenis tuntutan
  insert into claim_types(company_id, name, limit_per_item, requires_receipt, mileage_rate) values
    (p_company,'Mileage',null,false,0.60),
    (p_company,'Parking & Tol',null,true,null),
    (p_company,'Grab / Teksi',null,true,null),
    (p_company,'Makan (outstation)',50,true,null),
    (p_company,'Lain-lain',null,true,null);

  -- komponen gaji asas
  insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable) values
    (p_company,'BASIC','Gaji Pokok','earning',true,true,true),
    (p_company,'ALLOWANCE','Elaun Tetap','earning',true,true,true),
    (p_company,'COMMISSION','Komisen','earning',true,true,true),
    (p_company,'OT','Kerja Lebih Masa','earning',true,false,true),
    (p_company,'CLAIM','Bayaran Balik Tuntutan','earning',false,false,false),
    (p_company,'UNPAID','Potongan Cuti Tanpa Gaji','deduction',true,true,true);

  -- automasi WhatsApp
  insert into automation_rules(company_id, name, event_type, target, message_template) values
    (p_company,'Pekerja memohon cuti — maklumkan pengganti tugas','leave.submitted','cover_person',
     'Assalamualaikum {{pic}}, {{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari) dan menamakan anda sebagai pengganti tugas. Sila uruskan serahan tugas dengan {{nama}}. Status: {{status}}.'),
    (p_company,'Pekerja memohon cuti — maklumkan HR','leave.submitted','role_hr',
     '{{nama}} ({{jabatan}}) memohon {{jenis}} {{tarikh}} ({{days}} hari). Pengganti tugas: {{pic}}.'),
    (p_company,'Cuti diluluskan — maklumkan pengganti tugas','leave.approved','cover_person',
     'Makluman: cuti {{nama}} {{tarikh}} telah diluluskan. Anda ialah pengganti tugas sepanjang tempoh ini.'),
    (p_company,'Pekerja lewat masuk','attendance.late','subject',
     'Assalamualaikum {{nama}}, sistem merekodkan anda mendaftar masuk pada pukul {{clock_in}} hari ini (lewat {{late_minutes}} minit). Ini kali ke-{{late_count_month}} bagi bulan ini. Sekiranya ada sebab, sila balas mesej ini.'),
    (p_company,'Lewat 3 kali sebulan — maklumkan ketua','attendance.late','subject_dept_head',
     '{{nama}} lewat masuk kali ke-{{late_count_month}} bulan ini (hari ini {{clock_in}}).'),
    (p_company,'Tugasan kelulusan baharu','approval.task_assigned','subject',
     'Terdapat permohonan yang menunggu kelulusan anda: {{title}}. Sila balas LULUS atau TOLAK <sebab>.'),
    (p_company,'Peringatan kelulusan','approval.reminder','subject',
     'Peringatan: {{title}} masih menunggu kelulusan anda.'),
    (p_company,'Permohonan diluluskan','approval.approved','subject',
     '{{nama}}, permohonan anda "{{title}}" telah diluluskan.'),
    (p_company,'Permohonan ditolak','approval.rejected','subject',
     '{{nama}}, permohonan anda "{{title}}" telah ditolak. Sila semak sebabnya dalam aplikasi.'),
    (p_company,'Permohonan dihantar balik','approval.returned','subject',
     '{{nama}}, permohonan "{{title}}" telah dikembalikan untuk pembetulan.'),
    (p_company,'Melepasi tempoh sasaran — maklumkan CEO','approval.sla_breached','role_ceo',
     'Permohonan "{{title}}" tidak selesai dalam tempoh hari yang sama.');
  update automation_rules set condition = '{"field":"late_count_month","op":">=","value":3}'
   where company_id = p_company and name like 'Lewat 3 kali%';
end $$;

-- Kemas kini syarikat sedia ada
update automation_rules set name = 'Pekerja memohon cuti — maklumkan pengganti tugas' where name = 'Staff mohon cuti — maklum PIC ganti';
update automation_rules set name = 'Pekerja memohon cuti — maklumkan HR' where name = 'Staff mohon cuti — maklum HR';
update automation_rules set name = 'Cuti diluluskan — maklumkan pengganti tugas' where name = 'Cuti diluluskan — maklum PIC ganti';
update automation_rules set name = 'Pekerja lewat masuk' where name = 'Staff lewat masuk';
update automation_rules set name = 'Lewat 3 kali sebulan — maklumkan ketua' where name = 'Lewat 3 kali sebulan — maklum ketua';
update automation_rules set name = 'Tugasan kelulusan baharu' where name = 'Tugasan kelulusan baru';
update automation_rules set name = 'Melepasi tempoh sasaran — maklumkan CEO' where name = 'Lewat SLA — maklum CEO';
update automation_rules set message_template = replace(message_template, 'dan menamakan anda sebagai PIC ganti. Sila semak handover dengan {{nama}}. Status: {{status}}.', 'dan menamakan anda sebagai pengganti tugas. Sila uruskan serahan tugas dengan {{nama}}. Status: {{status}}.');
update automation_rules set message_template = replace(message_template, 'PIC ganti: {{pic}}.', 'Pengganti tugas: {{pic}}.');
update automation_rules set message_template = 'Makluman: cuti {{nama}} {{tarikh}} telah diluluskan. Anda ialah pengganti tugas sepanjang tempoh ini.' where message_template = 'Makluman: cuti {{nama}} {{tarikh}} telah DILULUSKAN. Anda PIC ganti sepanjang tempoh ini.';
update automation_rules set message_template = 'Assalamualaikum {{nama}}, sistem merekodkan anda mendaftar masuk pada pukul {{clock_in}} hari ini (lewat {{late_minutes}} minit). Ini kali ke-{{late_count_month}} bagi bulan ini. Sekiranya ada sebab, sila balas mesej ini.' where message_template = 'Assalamualaikum {{nama}}, sistem rekod anda clock-in pukul {{clock_in}} hari ini ({{late_minutes}} minit lewat). Ini kali ke-{{late_count_month}} bulan ini. Jika ada sebab, balas mesej ini.';
update automation_rules set message_template = 'Terdapat permohonan yang menunggu kelulusan anda: {{title}}. Sila balas LULUS atau TOLAK <sebab>.' where message_template = 'Ada permohonan menunggu kelulusan anda: {{title}}. Balas LULUS atau TOLAK <sebab>.';
update automation_rules set message_template = '{{nama}}, permohonan anda "{{title}}" telah diluluskan.' where message_template = 'Tahniah {{nama}}, permohonan anda "{{title}}" telah DILULUSKAN.';
update automation_rules set message_template = '{{nama}}, permohonan anda "{{title}}" telah ditolak. Sila semak sebabnya dalam aplikasi.' where message_template = 'Maaf {{nama}}, permohonan anda "{{title}}" telah ditolak. Semak sebab dalam sistem.';
update automation_rules set message_template = '{{nama}}, permohonan "{{title}}" telah dikembalikan untuk pembetulan.' where message_template = '{{nama}}, permohonan "{{title}}" dihantar balik untuk pembetulan.';
update approval_workflow_steps set name = 'Kewangan' where name = 'Finance';
