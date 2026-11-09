-- =====================================================================
--  HR lebih mudah II (bahagian 1)
--  1. Kalendar cuti pasukan
--  2. Permohonan surat oleh pekerja (pengesahan majikan / gaji)
--  3. Kerja lebih masa (Akta Kerja 1955 s.60A(3): 1.5× hari biasa, 2× hari rehat, 3× cuti umum)
--  4. Pengumuman syarikat + rekod bacaan
-- =====================================================================

alter table companies add column if not exists address text;

-- ---------------------------------------------------------------------
-- 3. Kerja lebih masa
-- ---------------------------------------------------------------------
create table if not exists overtime_requests (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments(id) on delete cascade,
  work_date            date not null,
  hours                numeric(4,1) not null check (hours > 0 and hours <= 12),
  day_type             text not null default 'normal' check (day_type in ('normal','rest','holiday')),
  reason               text not null,
  status               request_status not null default 'pending',
  approval_request_id  uuid references approval_requests(id),
  monthly_basic        numeric(12,2),
  amount               numeric(12,2),
  paid_via_payroll_run uuid references payroll_runs(id) on delete set null,
  created_via          action_channel not null default 'web',
  created_at           timestamptz not null default now()
);
alter table overtime_requests enable row level security;
create policy read_ot on overtime_requests for select using (can_view_employment(employment_id) or has_role(employment_company(employment_id), '{hr,finance,ceo,admin}'));

-- ---------------------------------------------------------------------
-- Hasil kelulusan bagi jenis permohonan baharu (tanpa mengubah enjin asas):
-- apabila approval_requests.status berubah, kemas kini rekod rujukan.
-- ---------------------------------------------------------------------
create or replace function approval_extra_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare o overtime_requests; asas numeric; kadar numeric;
begin
  if new.status = old.status then return new; end if;
  if new.request_type = 'overtime' then
    update overtime_requests set status = new.status where id = new.reference_id returning * into o;
    if new.status = 'approved' and o.id is not null then
      select coalesce(sum(ec.amount), 0) into asas from employment_compensation ec join pay_components pc on pc.id = ec.component_id
       where ec.employment_id = o.employment_id and pc.code = 'BASIC'
         and ec.effective_from <= o.work_date and (ec.effective_to is null or ec.effective_to >= o.work_date);
      -- kadar sejam = gaji bulanan ÷ 26 ÷ 8 jam (Akta Kerja s.60I)
      kadar := case o.day_type when 'rest' then 2.0 when 'holiday' then 3.0 else 1.5 end;
      update overtime_requests set amount = round(asas / 26 / 8 * kadar * o.hours, 2), monthly_basic = asas where id = o.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists approval_extra_outcome_upd on approval_requests;
create trigger approval_extra_outcome_upd after update of status on approval_requests
  for each row execute function approval_extra_outcome();

-- Aliran lalai: Ketua Jabatan (hari yang sama)
create or replace function ensure_workflow(p_company uuid, p_type request_type) returns approval_workflows
language plpgsql security definer set search_path = public as $$
declare wf approval_workflows;
begin
  select * into wf from approval_workflows where company_id = p_company and request_type = p_type and active;
  if wf.id is null then
    insert into approval_workflows(company_id, request_type, name, sla)
    values (p_company, p_type, case p_type when 'overtime' then 'Kerja Lebih Masa' when 'salary_advance' then 'Pendahuluan Gaji' else 'Kelulusan ' || p_type end, 'same_day')
    returning * into wf;
    insert into approval_workflow_steps(workflow_id, step_order, name, approver) values (wf.id, 1, 'Ketua Jabatan', 'dept_head');
    if p_type = 'salary_advance' then
      insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values (wf.id, 2, 'Kewangan', 'role', 'finance');
    end if;
  end if;
  return wf;
end $$;

select ensure_workflow(id, 'overtime') from companies;

create or replace function submit_overtime(p_employment uuid, p_date date, p_hours numeric, p_day_type text, p_reason text,
                                           p_via action_channel default 'web', p_on_behalf uuid default null)
returns overtime_requests language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; o overtime_requests; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini tidak aktif'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Kerja lebih masa hanya boleh dituntut selepas dilakukan'; end if;
  if p_date < (now() at time zone 'Asia/Kuala_Lumpur')::date - 60 then raise exception 'Tuntutan kerja lebih masa melebihi 60 hari'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 12 then raise exception 'Jam kerja lebih masa tidak sah (maksimum 12 jam sehari)'; end if;
  if coalesce(p_day_type, 'normal') not in ('normal','rest','holiday') then raise exception 'Jenis hari tidak sah'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan kerja yang dilakukan'; end if;
  if exists (select 1 from overtime_requests x where x.employment_id = e.id and x.work_date = p_date and x.status in ('pending','approved')) then
    raise exception 'Kerja lebih masa bagi tarikh ini telah dimohon';
  end if;
  perform ensure_workflow(e.company_id, 'overtime');
  insert into overtime_requests(employment_id, work_date, hours, day_type, reason, created_via)
  values (e.id, p_date, round(p_hours, 1), coalesce(p_day_type, 'normal'), trim(p_reason), p_via) returning * into o;
  rid := approval_create('overtime', o.id, e.id,
           'Kerja lebih masa ' || fmt_num(o.hours) || ' jam · ' || fmt_tarikh(p_date),
           jsonb_build_object('work_date', p_date, 'hours', o.hours, 'day_type', o.day_type, 'reason', o.reason), false, p_via);
  update overtime_requests set approval_request_id = rid where id = o.id returning * into o;
  return o;
end $$;

-- Komponen gaji untuk kerja lebih masa yang diluluskan (tidak tertakluk KWSP; tertakluk PERKESO & cukai — sama seperti OT)
insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable)
select id, 'OT_LULUS', 'Kerja Lebih Masa (diluluskan)', 'earning', true, false, true from companies
on conflict do nothing;

create or replace function pay_component_is_fixed(p_code text) returns boolean
language sql immutable as $$ select p_code not in ('COMMISSION','OT','OT_LULUS','ADVANCE','CLAIM','UNPAID') $$;

-- Pembungkus payroll_calculate: segerakkan OT diluluskan ke pelarasan bulan itu sebelum kiraan.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'payroll_calculate_core') then
    alter function payroll_calculate(uuid) rename to payroll_calculate_core;
  end if;
end $$;
revoke all on function payroll_calculate_core(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function payroll_calculate_core(uuid) from anon, authenticated;
  end if;
end $$;

create or replace function payroll_sync_extras(p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; d0 date; d1 date; x record;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null then return; end if;
  d0 := make_date(r.period_year, r.period_month, 1); d1 := (d0 + interval '1 month - 1 day')::date;
  insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable)
  values (r.company_id, 'OT_LULUS', 'Kerja Lebih Masa (diluluskan)', 'earning', true, false, true) on conflict do nothing;
  -- lepaskan & ikat semula
  update overtime_requests set paid_via_payroll_run = null where paid_via_payroll_run = r.id;
  update overtime_requests o set paid_via_payroll_run = r.id
    from employments e
   where e.id = o.employment_id and e.company_id = r.company_id and o.status = 'approved' and o.paid_via_payroll_run is null
     and o.work_date <= d1 and o.amount > 0;
  delete from payroll_adjustments where payroll_run_id = r.id and component_code = 'OT_LULUS';
  for x in select employment_id, sum(amount) amt, sum(hours) jam from overtime_requests where paid_via_payroll_run = r.id group by employment_id loop
    insert into payroll_adjustments(payroll_run_id, employment_id, component_code, amount, note)
    values (r.id, x.employment_id, 'OT_LULUS', x.amt, fmt_num(x.jam) || ' jam kerja lebih masa diluluskan');
  end loop;
end $$;

create or replace function payroll_calculate(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status in ('draft','calculated','returned') then perform payroll_sync_extras(p_run); end if;
  return payroll_calculate_core(p_run);
end $$;

create or replace function my_overtime(p_employment uuid)
returns table(id uuid, work_date date, hours numeric, day_type text, reason text, status request_status, amount numeric, approval_request_id uuid)
language sql stable security definer set search_path = public as $$
  select o.id, o.work_date, o.hours, o.day_type, o.reason, o.status, o.amount, o.approval_request_id
    from overtime_requests o join employments e on e.id = o.employment_id
   where o.employment_id = p_employment and e.person_id = current_person_id()
   order by o.work_date desc limit 50
$$;

-- ---------------------------------------------------------------------
-- 1. Kalendar cuti pasukan
-- ---------------------------------------------------------------------
create or replace function team_calendar(p_company uuid, p_from date, p_to date, p_department uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hr boolean; jab uuid[];
begin
  if not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  if p_to < p_from or p_to - p_from > 62 then raise exception 'Julat tarikh tidak sah'; end if;
  hr := has_role(p_company, '{hr,finance,ceo,admin}');
  -- bukan pengurusan: hanya jabatan sendiri / jabatan yang diketuai
  if not hr then
    select array_agg(distinct x) into jab from (
      select department_id x from employments where person_id = current_person_id() and company_id = p_company and status in ('probation','active')
      union select id from departments where company_id = p_company and head_person_id = current_person_id()) z where x is not null;
  end if;
  return jsonb_build_object(
    'leave', coalesce((
      select jsonb_agg(jsonb_build_object('employment_id', e.id, 'name', coalesce(p.preferred_name, p.full_name), 'department', d.name,
               'department_id', e.department_id, 'start', greatest(lr.start_date, p_from), 'end', least(lr.end_date, p_to),
               'half_day', lr.half_day, 'status', lr.status,
               -- jenis cuti (termasuk MC) hanya untuk pengurusan
               'type', case when hr then lt.code end, 'type_name', case when hr then lt.name else 'Cuti' end)
             order by lr.start_date, coalesce(p.preferred_name, p.full_name))
        from leave_requests lr join employments e on e.id = lr.employment_id join persons p on p.id = e.person_id
        join leave_types lt on lt.id = lr.leave_type_id left join departments d on d.id = e.department_id
       where e.company_id = p_company and lr.status in ('approved','pending')
         and lr.start_date <= p_to and lr.end_date >= p_from
         and (p_department is null or e.department_id = p_department)
         and (hr or e.department_id = any(coalesce(jab, array[]::uuid[])))), '[]'),
    'holidays', coalesce((select jsonb_agg(jsonb_build_object('date', h.holiday_date, 'name', h.name) order by h.holiday_date)
                            from company_holidays(p_company, p_from, p_to) h), '[]'),
    'birthdays', coalesce((select jsonb_agg(to_jsonb(b)) from team_birthdays(p_company, p_from, p_to) b), '[]'),
    'headcount', (select jsonb_object_agg(coalesce(department_id::text, '-'), n) from (
        select department_id, count(*) n from employments where company_id = p_company and status in ('probation','active') group by 1) z),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name) from departments
                              where company_id = p_company and (hr or id = any(coalesce(jab, array[]::uuid[])))), '[]'),
    'full', hr
  );
end $$;

-- ---------------------------------------------------------------------
-- 2. Permohonan surat
-- ---------------------------------------------------------------------
create table if not exists letter_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  employment_id   uuid not null references employments(id) on delete cascade,
  kind            text not null check (kind in ('employment','salary')),
  purpose         text not null,
  addressed_to    text,
  status          text not null default 'pending' check (status in ('pending','issued','rejected','cancelled')),
  ref_no          text,
  issued_at       timestamptz,
  issued_by       uuid references persons(id),
  reject_reason   text,
  snapshot        jsonb,          -- data surat dibekukan semasa dikeluarkan
  created_at      timestamptz not null default now()
);
alter table letter_requests enable row level security;
create policy read_letter on letter_requests for select using (
  has_role(company_id, '{hr,admin}') or exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));

create or replace function request_letter(p_employment uuid, p_kind text, p_purpose text, p_addressed_to text default null,
                                          p_via action_channel default 'web', p_on_behalf uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; nid uuid; nama text; p record;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini tidak aktif'; end if;
  if p_kind not in ('employment','salary') then raise exception 'Jenis surat tidak sah'; end if;
  if coalesce(trim(p_purpose), '') = '' then raise exception 'Sila nyatakan tujuan surat'; end if;
  if (select count(*) from letter_requests where employment_id = e.id and status = 'pending') >= 3 then
    raise exception 'Anda mempunyai 3 permohonan surat yang belum diproses';
  end if;
  insert into letter_requests(company_id, employment_id, kind, purpose, addressed_to)
  values (e.company_id, e.id, p_kind, trim(p_purpose), nullif(trim(coalesce(p_addressed_to, '')), '')) returning id into nid;
  select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
  for p in select distinct ur.person_id from user_roles ur
             join employments x on x.person_id = ur.person_id and x.company_id = e.company_id and x.status in ('probation','active')
            where ur.company_id = e.company_id and ur.role = 'hr' loop
    perform notify_person(p.person_id, e.company_id,
      nama || ' memohon ' || case p_kind when 'salary' then 'surat pengesahan gaji' else 'surat pengesahan majikan' end ||
      ' (' || left(trim(p_purpose), 120) || '). Keluarkan di HRBoost → Surat.');
  end loop;
  return nid;
end $$;

create or replace function cancel_letter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update letter_requests l set status = 'cancelled'
   where l.id = p_id and l.status = 'pending'
     and exists (select 1 from employments e where e.id = l.employment_id and e.person_id = current_person_id());
  if not found then raise exception 'Permohonan tidak dapat dibatalkan'; end if;
end $$;

create or replace function letter_list(p_company uuid, p_mine boolean default false)
returns table(id uuid, employment_id uuid, name text, employee_no text, kind text, purpose text, addressed_to text, status text,
              ref_no text, issued_at timestamptz, reject_reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not p_mine and not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select l.id, l.employment_id, coalesce(p.preferred_name, p.full_name), e.employee_no, l.kind, l.purpose, l.addressed_to, l.status,
         l.ref_no, l.issued_at, l.reject_reason, l.created_at
    from letter_requests l join employments e on e.id = l.employment_id join persons p on p.id = e.person_id
   where l.company_id = p_company and (not p_mine or e.person_id = current_person_id())
   order by (l.status = 'pending') desc, l.created_at desc
   limit 200;
end $$;

-- Data surat (dibina semasa dikeluarkan, kemudian dibekukan)
create or replace function letter_build_snapshot(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l letter_requests; e employments; p persons; c companies; gaji numeric; elaun numeric;
begin
  select * into l from letter_requests where id = p_id;
  select * into e from employments where id = l.employment_id;
  select * into p from persons where id = e.person_id;
  select * into c from companies where id = l.company_id;
  select coalesce(sum(ec.amount) filter (where pc.code = 'BASIC'), 0), coalesce(sum(ec.amount) filter (where pc.code <> 'BASIC' and pc.kind = 'earning'), 0)
    into gaji, elaun
    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
   where ec.employment_id = e.id and ec.effective_from <= current_date and (ec.effective_to is null or ec.effective_to >= current_date);
  return jsonb_build_object(
    'company', jsonb_build_object('name', c.name, 'reg_no', c.reg_no, 'address', c.address),
    'full_name', p.full_name, 'ic_no', p.ic_no, 'employee_no', e.employee_no,
    'position', (select title from positions where id = e.position_id),
    'department', (select name from departments where id = e.department_id),
    'join_date', e.join_date, 'employment_type', e.employment_type, 'status', e.status,
    'basic', case when l.kind = 'salary' then gaji end, 'allowances', case when l.kind = 'salary' then elaun end);
end $$;

create or replace function issue_letter(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare l letter_requests; e employments; seq int; ruj text; tandatangan jsonb;
begin
  select * into l from letter_requests where id = p_id for update;
  if l.id is null or not has_role(l.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if l.status <> 'pending' then raise exception 'Permohonan ini telah diproses'; end if;
  select count(*) + 1 into seq from letter_requests where company_id = l.company_id and ref_no is not null
     and extract(year from issued_at) = extract(year from now());
  ruj := (select code from companies where id = l.company_id) || '/HR/' || to_char(now(), 'YYYY') || '/' || lpad(seq::text, 4, '0');
  select jsonb_build_object('name', coalesce(pe.full_name, pe.preferred_name), 'position', coalesce(po.title, 'Pengurus Sumber Manusia'))
    into tandatangan
    from persons pe left join employments em on em.person_id = pe.id and em.company_id = l.company_id and em.status in ('probation','active')
    left join positions po on po.id = em.position_id
   where pe.id = current_person_id() limit 1;
  update letter_requests set status = 'issued', ref_no = ruj, issued_at = now(), issued_by = current_person_id(),
         snapshot = letter_build_snapshot(l.id) || jsonb_build_object('signatory', tandatangan)
   where id = l.id;
  select * into e from employments where id = l.employment_id;
  if l.kind = 'salary' then
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'salary_letter', 'web');
  end if;
  perform notify_person(e.person_id, l.company_id,
    'Surat ' || case l.kind when 'salary' then 'pengesahan gaji' else 'pengesahan majikan' end || ' anda telah dikeluarkan (' || ruj ||
    '). Muat turun di HRBoost → Mohon → Surat.');
  return ruj;
end $$;

create or replace function reject_letter(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare l letter_requests; e employments;
begin
  select * into l from letter_requests where id = p_id;
  if l.id is null or not has_role(l.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if l.status <> 'pending' then raise exception 'Permohonan ini telah diproses'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  update letter_requests set status = 'rejected', reject_reason = trim(p_reason) where id = l.id;
  select * into e from employments where id = l.employment_id;
  perform notify_person(e.person_id, l.company_id, 'Permohonan surat anda tidak dapat diproses: ' || trim(p_reason));
end $$;

create or replace function letter_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l letter_requests; e employments;
begin
  select * into l from letter_requests where id = p_id;
  select * into e from employments where id = l.employment_id;
  if l.id is null or l.status <> 'issued' or not (has_role(l.company_id, '{hr,admin}') or e.person_id = current_person_id()) then
    raise exception 'Surat tidak dijumpai';
  end if;
  return l.snapshot || jsonb_build_object('kind', l.kind, 'purpose', l.purpose, 'addressed_to', l.addressed_to, 'ref_no', l.ref_no, 'issued_at', l.issued_at);
end $$;

-- ---------------------------------------------------------------------
-- 4. Pengumuman syarikat
-- ---------------------------------------------------------------------
create table if not exists announcements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  title        text not null check (length(title) between 3 and 120),
  body         text not null check (length(body) between 3 and 2000),
  sent_whatsapp boolean not null default false,
  created_by   uuid references persons(id),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);
create table if not exists announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  person_id       uuid not null references persons(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, person_id)
);
alter table announcements enable row level security;
alter table announcement_reads enable row level security;
create policy read_ann on announcements for select using (is_company_member(company_id));
create policy read_ann_reads on announcement_reads for select using (person_id = current_person_id());

create or replace function post_announcement(p_company uuid, p_title text, p_body text, p_whatsapp boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid; p record; n int := 0; nama text;
begin
  if not has_role(p_company, '{hr,ceo,admin}') then raise exception 'Hanya HR / CEO / Pentadbir'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Tajuk terlalu pendek'; end if;
  if length(trim(coalesce(p_body, ''))) < 3 then raise exception 'Kandungan terlalu pendek'; end if;
  insert into announcements(company_id, title, body, sent_whatsapp, created_by)
  values (p_company, trim(p_title), trim(p_body), coalesce(p_whatsapp, false), current_person_id()) returning id into nid;
  insert into announcement_reads(announcement_id, person_id) values (nid, current_person_id()) on conflict do nothing;
  if p_whatsapp then
    select name into nama from companies where id = p_company;
    for p in select distinct e.person_id from employments e
              where e.company_id = p_company and e.status in ('probation','active') and e.person_id <> current_person_id() loop
      perform notify_person(p.person_id, p_company, 'Pengumuman ' || nama || E':\n*' || trim(p_title) || E'*\n' || left(trim(p_body), 900));
      n := n + 1;
    end loop;
  end if;
  return nid;
end $$;

create or replace function archive_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update announcements set archived_at = now() where id = p_id and has_role(company_id, '{hr,ceo,admin}') and archived_at is null;
  if not found then raise exception 'Tidak dibenarkan'; end if;
end $$;

create or replace function mark_announcement_read(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from announcements a where a.id = p_id and is_company_member(a.company_id)) then raise exception 'Tidak dibenarkan'; end if;
  insert into announcement_reads(announcement_id, person_id) values (p_id, current_person_id()) on conflict do nothing;
end $$;

create or replace function company_announcements(p_company uuid, p_include_archived boolean default false)
returns table(id uuid, title text, body text, created_at timestamptz, author text, sent_whatsapp boolean, archived boolean,
              is_read boolean, read_count int, audience int)
language plpgsql stable security definer set search_path = public as $$
declare urus boolean := has_role(p_company, '{hr,ceo,admin}');
        jumlah int := (select count(*) from employments e where e.company_id = p_company and e.status in ('probation','active'));
begin
  if not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  return query
  select a.id, a.title, a.body, a.created_at, coalesce(p.preferred_name, p.full_name), a.sent_whatsapp, a.archived_at is not null,
         exists (select 1 from announcement_reads r where r.announcement_id = a.id and r.person_id = current_person_id()),
         case when urus then (select count(*)::int from announcement_reads r join employments e on e.person_id = r.person_id
                                and e.company_id = p_company and e.status in ('probation','active') where r.announcement_id = a.id) end,
         case when urus then jumlah end
    from announcements a left join persons p on p.id = a.created_by
   where a.company_id = p_company and (a.archived_at is null or (p_include_archived and urus))
   order by a.created_at desc limit 50;
end $$;

create or replace function announcement_unread(p_id uuid) returns table(employment_id uuid, name text, department text)
language plpgsql stable security definer set search_path = public as $$
declare a announcements;
begin
  select * into a from announcements where id = p_id;
  if a.id is null or not has_role(a.company_id, '{hr,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select e.id, coalesce(p.preferred_name, p.full_name), d.name
    from employments e join persons p on p.id = e.person_id left join departments d on d.id = e.department_id
   where e.company_id = a.company_id and e.status in ('probation','active')
     and not exists (select 1 from announcement_reads r where r.announcement_id = a.id and r.person_id = e.person_id)
   order by 2;
end $$;

-- ---------------------------------------------------------------------
-- Kebenaran
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['approval_extra_outcome()', 'ensure_workflow(uuid, request_type)', 'payroll_sync_extras(uuid)', 'letter_build_snapshot(uuid)',
    'submit_overtime(uuid, date, numeric, text, text, action_channel, uuid)', 'payroll_calculate(uuid)', 'my_overtime(uuid)',
    'team_calendar(uuid, date, date, uuid)', 'request_letter(uuid, text, text, text, action_channel, uuid)', 'cancel_letter(uuid)',
    'letter_list(uuid, boolean)', 'issue_letter(uuid)', 'reject_letter(uuid, text)', 'letter_view(uuid)',
    'post_announcement(uuid, text, text, boolean)', 'archive_announcement(uuid)', 'mark_announcement_read(uuid)',
    'company_announcements(uuid, boolean)', 'announcement_unread(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f in ('approval_extra_outcome()', 'ensure_workflow(uuid, request_type)', 'payroll_sync_extras(uuid)', 'letter_build_snapshot(uuid)') then
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;
