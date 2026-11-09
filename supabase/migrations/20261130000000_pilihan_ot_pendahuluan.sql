-- =====================================================================
--  Pelarasan selepas maklum balas pemilik produk:
--  * Kerja lebih masa ialah PILIHAN setiap syarikat (lalai: tidak digunakan).
--  * Pendahuluan gaji: jumlah bebas (tiada had peratus), diluluskan oleh CEO.
--    Aliran boleh diubah oleh HR dalam Tetapan → Aliran Kelulusan.
-- =====================================================================

alter table companies add column if not exists overtime_enabled boolean not null default false;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant update (overtime_enabled) on companies to authenticated;
  end if;
end $$;

create or replace function set_overtime_enabled(p_company uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  update companies set overtime_enabled = p_on where id = p_company;
end $$;

create or replace function submit_overtime(p_employment uuid, p_date date, p_hours numeric, p_day_type text, p_reason text,
                                           p_via action_channel default 'web', p_on_behalf uuid default null)
returns overtime_requests language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; o overtime_requests; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini tidak aktif'; end if;
  if not coalesce((select overtime_enabled from companies where id = e.company_id), false) then
    raise exception 'Kerja lebih masa tidak digunakan di syarikat ini';
  end if;
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

-- Aliran lalai pendahuluan gaji: CEO sahaja
create or replace function ensure_workflow(p_company uuid, p_type request_type) returns approval_workflows
language plpgsql security definer set search_path = public as $$
declare wf approval_workflows;
begin
  select * into wf from approval_workflows where company_id = p_company and request_type = p_type and active;
  if wf.id is null then
    insert into approval_workflows(company_id, request_type, name, sla)
    values (p_company, p_type, case p_type when 'overtime' then 'Kerja Lebih Masa' when 'salary_advance' then 'Pendahuluan Gaji' else 'Kelulusan ' || p_type end, 'same_day')
    returning * into wf;
    if p_type = 'salary_advance' then
      insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values (wf.id, 1, 'CEO', 'role', 'ceo');
    else
      insert into approval_workflow_steps(workflow_id, step_order, name, approver) values (wf.id, 1, 'Ketua Jabatan', 'dept_head');
    end if;
  end if;
  return wf;
end $$;

-- Aliran sedia ada (lalai lama Ketua Jabatan → Kewangan) ditukar kepada CEO sahaja,
-- melainkan tiada permohonan yang sedang berjalan.
do $$
declare w record;
begin
  for w in select wf.id from approval_workflows wf
            where wf.request_type = 'salary_advance'
              and not exists (select 1 from approval_requests r where r.workflow_id = wf.id and r.status = 'pending') loop
    delete from approval_workflow_steps where workflow_id = w.id;
    insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values (w.id, 1, 'CEO', 'role', 'ceo');
  end loop;
end $$;

create or replace function submit_salary_advance(p_employment uuid, p_amount numeric, p_reason text,
                                                 p_via action_channel default 'web', p_on_behalf uuid default null)
returns salary_advances language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; a salary_advances; rid uuid;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  if e.status <> 'active' then raise exception 'Pendahuluan gaji hanya untuk pekerja yang telah disahkan jawatan'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'Jumlah tidak sah'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  if exists (select 1 from salary_advances x where x.employment_id = e.id and (x.status = 'pending' or (x.status = 'approved' and x.deducted_via_payroll_run is null))) then
    raise exception 'Anda masih mempunyai pendahuluan gaji yang belum selesai';
  end if;
  perform ensure_workflow(e.company_id, 'salary_advance');
  -- Tiada lulus automatik: setiap peringkat peranan mesti mempunyai sekurang-kurangnya seorang pelulus
  if exists (select 1 from approval_workflows w join approval_workflow_steps s on s.workflow_id = w.id
              where w.company_id = e.company_id and w.request_type = 'salary_advance' and w.active and s.approver = 'role'
                and not exists (select 1 from user_roles r where r.company_id = e.company_id and r.role = s.approver_role)) then
    raise exception 'Pelulus pendahuluan gaji (CEO) belum ditetapkan. Hubungi HR.';
  end if;
  insert into salary_advances(employment_id, amount, reason) values (e.id, round(p_amount, 2), trim(p_reason)) returning * into a;
  rid := approval_create('salary_advance', a.id, e.id,
           'Pendahuluan gaji RM' || to_char(a.amount, 'FM999,999,990.00'),
           jsonb_build_object('amount', a.amount, 'reason', a.reason), false, p_via);
  update salary_advances set approval_request_id = rid where id = a.id returning * into a;
  return a;
end $$;

drop function if exists my_salary_advances(uuid);
create function my_salary_advances(p_employment uuid)
returns table(id uuid, amount numeric, reason text, status request_status, deduct_year int, deduct_month int, deducted boolean, approval_request_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.amount, a.reason, a.status, a.deduct_year, a.deduct_month, a.deducted_via_payroll_run is not null, a.approval_request_id, a.created_at
    from salary_advances a join employments e on e.id = a.employment_id
   where a.employment_id = p_employment and e.person_id = current_person_id()
   order by a.created_at desc limit 20
$$;

delete from platform_settings where key = 'salary_advance';
drop function if exists salary_advance_limit(uuid);

do $$
declare f text;
begin
  foreach f in array array['set_overtime_enabled(uuid, boolean)', 'submit_overtime(uuid, date, numeric, text, text, action_channel, uuid)',
    'ensure_workflow(uuid, request_type)', 'submit_salary_advance(uuid, numeric, text, action_channel, uuid)', 'my_salary_advances(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f = 'ensure_workflow(uuid, request_type)' then
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;

-- Aliran lalai untuk syarikat baharu (supaya HR boleh melihat & mengubahnya dalam Tetapan → Aliran Kelulusan)
create or replace function trg_company_extra_workflows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ensure_workflow(new.id, 'salary_advance');
  perform ensure_workflow(new.id, 'overtime');
  return new;
end $$;
revoke all on function trg_company_extra_workflows() from public;
drop trigger if exists company_extra_workflows on companies;
create trigger company_extra_workflows after insert on companies for each row execute function trg_company_extra_workflows();
select ensure_workflow(id, 'salary_advance'), ensure_workflow(id, 'overtime') from companies;
