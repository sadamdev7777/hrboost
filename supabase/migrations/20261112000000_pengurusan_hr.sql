-- =====================================================================
--  Fasa D3: Pengurusan HR (DashboardHR, Pekerja, TambahPekerja, ProfilPekerja)
--  Semua tindakan melalui RPC security definer (boleh dipanggil oleh app ATAU agent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Papan pemuka HR "Hari Ini" (agregat satu syarikat sahaja)
-- ---------------------------------------------------------------------
create or replace function hr_dashboard(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
        m0 date := date_trunc('month', today)::date; out jsonb;
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  select jsonb_build_object(
    'company_code', (select code from companies where id = p_company),
    'on_leave', coalesce((
      select jsonb_agg(jsonb_build_object('employment_id', e.id, 'name', coalesce(p.preferred_name, p.full_name),
               'leave', lt.code, 'leave_name', lt.name, 'half_day', lr.half_day, 'department', d.name)
             order by coalesce(p.preferred_name, p.full_name))
        from leave_requests lr join employments e on e.id = lr.employment_id
        join persons p on p.id = e.person_id join leave_types lt on lt.id = lr.leave_type_id
        left join departments d on d.id = e.department_id
       where e.company_id = p_company and lr.status = 'approved' and today between lr.start_date and lr.end_date), '[]'),
    'late_today', (select count(*) from attendance_records a join employments e on e.id = a.employment_id
                    where e.company_id = p_company and a.work_date = today and a.late_minutes > 0),
    'sla_breached', (select count(*) from approval_requests r
                      where r.company_id = p_company and r.status = 'pending' and r.sla_breached),
    'attention', coalesce((select jsonb_agg(x order by x->>'sort') from (
        -- permohonan melepasi tempoh
        select jsonb_build_object('sort', '1' || r.submitted_at, 'kind', 'sla', 'request_id', r.id,
                 'text', r.title || ' tertangguh' ||
                   coalesce(' di ' || (select string_agg(distinct t.step_name, ', ') from approval_tasks t
                                        where t.request_id = r.id and t.status = 'pending'), '')) x
          from approval_requests r where r.company_id = p_company and r.status = 'pending' and r.sla_breached
        union all
        -- tempoh percubaan tamat dalam 30 hari
        select jsonb_build_object('sort', '2' || e.probation_end_date, 'kind', 'probation', 'employment_id', e.id,
                 'text', 'Tempoh percubaan ' || coalesce(p.preferred_name, p.full_name) || ' tamat ' || fmt_tarikh(e.probation_end_date))
          from employments e join persons p on p.id = e.person_id
         where e.company_id = p_company and e.status = 'probation'
           and e.probation_end_date <= today + 30
        union all
        -- pertukaran akaun bank menunggu pengesahan
        select jsonb_build_object('sort', '3' || b.requested_at, 'kind', 'bank', 'employment_id', e.id,
                 'text', 'Pertukaran akaun bank ' || coalesce(p.preferred_name, p.full_name) || ' menunggu pengesahan')
          from bank_change_requests b join persons p on p.id = b.person_id
          join employments e on e.person_id = b.person_id and e.company_id = p_company and e.status in ('probation','active')
         where b.status = 'pending' and has_role(p_company, '{hr,admin}')
        union all
        -- lewat berulang bulan ini (3 kali atau lebih)
        select jsonb_build_object('sort', '4' || coalesce(p.preferred_name, p.full_name), 'kind', 'late', 'employment_id', e.id,
                 'text', coalesce(p.preferred_name, p.full_name) || ' lewat ' || count(*) || ' kali bulan ini')
          from attendance_records a join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
         where e.company_id = p_company and a.work_date >= m0 and a.late_minutes > 0
         group by e.id, p.preferred_name, p.full_name having count(*) >= 3
      ) s), '[]'),
    'claims_approved_month', coalesce((
      select sum(c.total_amount) from claims c join employments e on e.id = c.employment_id
        join approval_requests r on r.id = c.approval_request_id
       where e.company_id = p_company and c.status = 'approved' and r.completed_at >= m0), 0),
    'payroll_draft', (select (totals->>'gross')::numeric from payroll_runs
                       where company_id = p_company and period_year = extract(year from today)
                         and period_month = extract(month from today)),
    'headcount', (select count(*) from employments where company_id = p_company and status in ('probation','active'))
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- 2. Jemput pekerja: jana token & beratur mesej WhatsApp (dihantar oleh notify-sender).
--    Token mentah dipulangkan supaya HR boleh menyalin/kongsi pautan jika WhatsApp belum disambung.
-- ---------------------------------------------------------------------
create or replace function invite_employee(p_employment uuid, p_base_url text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare tok text; e employments; p persons; c companies; url text;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR/Admin'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini telah tamat'; end if;
  select * into p from persons where id = e.person_id;
  if p.auth_user_id is not null and exists (select 1 from onboarding_progress where employment_id = e.id and step = 'activate') then
    raise exception 'Pekerja ini sudah aktif';
  end if;
  select * into c from companies where id = e.company_id;
  if p_base_url !~ '^https?://[^\s/]+' then raise exception 'Alamat aplikasi tidak sah'; end if;
  tok := create_invite(p_employment);
  url := rtrim(p_base_url, '/') || '/jemputan/' || tok;
  insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
  values (e.company_id, p.id, 'whatsapp', p.phone_whatsapp,
          'Assalamualaikum ' || coalesce(p.preferred_name, p.full_name) || ', anda dijemput menyertai ' || c.name ||
          ' di HRBoost. Buka pautan ini dan sahkan 4 digit akhir kad pengenalan anda: ' || url ||
          ' (sah selama 7 hari)', true);
  return tok;
end $$;

-- ---------------------------------------------------------------------
-- 3. HR membuka maklumat peribadi sensitif (IC, bank, alamat, waris) -> data_access_log
-- ---------------------------------------------------------------------
create or replace function hr_view_sensitive(p_employment uuid, p_via action_channel default 'web')
returns jsonb language plpgsql security definer set search_path = public as $$
declare e employments; p persons; out jsonb;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  select * into p from persons where id = e.person_id;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  values (current_person_id(), p.id, 'profile', p_via);
  select jsonb_build_object(
    'full_name', p.full_name, 'ic_no', p.ic_no, 'date_of_birth', p.date_of_birth, 'gender', p.gender,
    'marital_status', p.marital_status, 'children_count', p.children_count, 'spouse_working', p.spouse_working,
    'phone', p.phone_whatsapp, 'email', p.email, 'address', p.address,
    'bank_name', p.bank_name, 'bank_account_no', p.bank_account_no,
    'epf_no', e.epf_no, 'socso_no', e.socso_no, 'tax_no', e.tax_no,
    'emergency', (select jsonb_agg(jsonb_build_object('name', name, 'relationship', relationship, 'phone', phone))
                    from emergency_contacts where person_id = p.id),
    'bank_change', (select jsonb_build_object('id', b.id, 'bank_name', b.bank_name, 'bank_account_no', b.bank_account_no,
                                              'requested_at', b.requested_at)
                      from bank_change_requests b where b.person_id = p.id and b.status = 'pending')
  ) into out;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- 4. Ubah gaji & jawatan / sahkan jawatan
--    p_data: department_id, position, employment_type, work_start ('09:00' atau ''), basic, effective_from, confirm
-- ---------------------------------------------------------------------
create or replace function hr_update_employment(p_employment uuid, p_data jsonb, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare e employments; d jsonb := coalesce(p_data, '{}'); pos uuid; comp uuid; eff date; amt numeric;
begin
  select * into e from employments where id = p_employment for update;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini telah tamat'; end if;

  if d ? 'department_id' then
    if nullif(d->>'department_id', '') is not null and not exists (
        select 1 from departments where id = (d->>'department_id')::uuid and company_id = e.company_id) then
      raise exception 'Jabatan tidak sah';
    end if;
    update employments set department_id = nullif(d->>'department_id', '')::uuid,
           manager_person_id = (select head_person_id from departments where id = nullif(d->>'department_id', '')::uuid)
     where id = e.id;
  end if;
  if d ? 'position' then
    if coalesce(trim(d->>'position'), '') = '' then
      update employments set position_id = null where id = e.id;
    else
      insert into positions(company_id, title) values (e.company_id, trim(d->>'position'))
      on conflict (company_id, title) do update set title = excluded.title returning id into pos;
      update employments set position_id = pos where id = e.id;
    end if;
  end if;
  if d ? 'employment_type' then
    update employments set employment_type = (d->>'employment_type')::employment_type where id = e.id;
  end if;
  if d ? 'work_start' then
    update employments set work_start = nullif(d->>'work_start', '')::time where id = e.id;
  end if;
  if coalesce((d->>'confirm')::boolean, false) then
    update employments set status = 'active', confirm_date = (now() at time zone 'Asia/Kuala_Lumpur')::date
     where id = e.id and status = 'probation';
    perform emit_event(e.company_id, 'employment.confirmed', e.person_id, e.id, '{}');
  end if;
  if nullif(d->>'basic', '') is not null then
    amt := (d->>'basic')::numeric;
    if amt < 0 then raise exception 'Gaji tidak sah'; end if;
    eff := coalesce(nullif(d->>'effective_from', '')::date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
    select id into comp from pay_components where company_id = e.company_id and code = 'BASIC';
    if comp is null then raise exception 'Komponen gaji pokok tiada'; end if;
    delete from employment_compensation
     where employment_id = e.id and component_id = comp and effective_from >= eff;
    update employment_compensation set effective_to = eff - 1
     where employment_id = e.id and component_id = comp and (effective_to is null or effective_to >= eff);
    insert into employment_compensation(employment_id, component_id, amount, effective_from)
    values (e.id, comp, amt, eff);
    insert into data_access_log(actor_person_id, subject_person_id, resource, via)
    values (current_person_id(), e.person_id, 'salary', p_via);
  end if;
  perform emit_event(e.company_id, 'employment.updated', e.person_id, e.id, d - 'basic');
end $$;

-- ---------------------------------------------------------------------
-- 5. Tamatkan pekerjaan (letak jawatan / ditamatkan / bersara).
--    Pekerja kekal aktif hingga hari bekerja terakhir; finalize_employment_ends()
--    (pg_cron setiap hari) menukar status selepas tarikh itu.
-- ---------------------------------------------------------------------
alter table employments add column if not exists end_status employment_status
  check (end_status in ('resigned','terminated','retired'));
alter table employments add column if not exists end_reason text;

create or replace function finalize_employment_ends() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from employments
            where end_status is not null and status in ('probation','active')
              and end_date < (now() at time zone 'Asia/Kuala_Lumpur')::date
            for update loop
    update employments set status = r.end_status where id = r.id;
    update employee_invites set expires_at = now() where employment_id = r.id and accepted_at is null;
    delete from user_roles where person_id = r.person_id and company_id = r.company_id;
    perform emit_event(r.company_id, 'employment.ended', r.person_id, r.id,
                       jsonb_build_object('status', r.end_status, 'end_date', r.end_date, 'reason', r.end_reason));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function end_employment(p_employment uuid, p_status employment_status, p_end_date date,
                                          p_reason text default null, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment for update;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  if p_status not in ('resigned','terminated','retired') then raise exception 'Status tamat tidak sah'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini telah tamat'; end if;
  if p_end_date is null or p_end_date < e.join_date then raise exception 'Tarikh akhir tidak sah'; end if;
  if e.person_id = current_person_id() then raise exception 'Anda tidak boleh menamatkan pekerjaan sendiri'; end if;
  update employments set end_date = p_end_date, end_status = p_status, end_reason = nullif(trim(p_reason), '')
   where id = e.id;
  perform emit_event(e.company_id, 'employment.ending', e.person_id, e.id,
                     jsonb_build_object('status', p_status, 'end_date', p_end_date));
  perform finalize_employment_ends();
end $$;

-- Batal penamatan yang belum berkuat kuasa
create or replace function cancel_employment_end(p_employment uuid, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment for update;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  if e.status not in ('probation','active') or e.end_status is null then raise exception 'Tiada penamatan untuk dibatalkan'; end if;
  update employments set end_date = null, end_status = null, end_reason = null where id = e.id;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-employment-ends';
    perform cron.schedule('hrboost-employment-ends', '5 16 * * *', 'select public.finalize_employment_ends()');
  end if;
end $$;

-- Ketua jabatan yang ditamatkan tidak lagi menjadi ketua
create or replace function trg_clear_dept_head() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('resigned','terminated','retired') and old.status in ('probation','active') then
    update departments set head_person_id = null where company_id = new.company_id and head_person_id = new.person_id;
  end if;
  return new;
end $$;
drop trigger if exists employment_clear_head on employments;
create trigger employment_clear_head after update of status on employments
  for each row execute function trg_clear_dept_head();

-- ---------------------------------------------------------------------
-- 6. Gaji semasa (tab Gaji di ProfilPekerja): HR / Kewangan sahaja, direkodkan
-- ---------------------------------------------------------------------
create or replace function hr_current_pay(p_employment uuid, p_via action_channel default 'web')
returns table(code text, name text, amount numeric, effective_from date)
language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  values (current_person_id(), e.person_id, 'salary', p_via);
  return query
    select pc.code, pc.name, ec.amount, ec.effective_from
      from employment_compensation ec join pay_components pc on pc.id = ec.component_id
     where ec.employment_id = e.id
       and ec.effective_from <= (now() at time zone 'Asia/Kuala_Lumpur')::date + 365
       and (ec.effective_to is null or ec.effective_to >= (now() at time zone 'Asia/Kuala_Lumpur')::date)
     order by pc.code, ec.effective_from;
end $$;

-- ---------------------------------------------------------------------
-- 7. Storan: HR boleh memuat naik dokumen ke folder pekerja syarikatnya
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Skema storage tiada: polisi dokumen HR dilangkau';
    return;
  end if;
  execute 'drop policy if exists peribadi_hr_insert on storage.objects';
  execute $p$
    create policy peribadi_hr_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'peribadi' and exists (
        select 1 from public.employments x
         where x.person_id::text = (storage.foldername(name))[1]
           and public.has_role(x.company_id, '{hr,admin}')))
  $p$;
end $$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'hr_dashboard(uuid)', 'invite_employee(uuid, text)', 'hr_view_sensitive(uuid, action_channel)',
    'hr_update_employment(uuid, jsonb, action_channel)',
    'end_employment(uuid, employment_status, date, text, action_channel)',
    'hr_current_pay(uuid, action_channel)', 'cancel_employment_end(uuid, action_channel)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  execute 'revoke execute on function trg_clear_dept_head() from public';
  execute 'revoke execute on function finalize_employment_ends() from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function finalize_employment_ends() from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. Bilangan syarikat lain tempat pekerja ini bekerja (ProfilPekerja). Hanya bilangan:
--    butiran di syarikat lain hanya untuk HR syarikat tersebut.
-- ---------------------------------------------------------------------
create or replace function person_other_companies(p_employment uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct o.company_id)::int
    from employments e join employments o on o.person_id = e.person_id and o.company_id <> e.company_id
   where e.id = p_employment and o.status in ('probation','active')
     and has_role(e.company_id, '{hr,ceo,admin}')
$$;
revoke execute on function person_other_companies(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function person_other_companies(uuid) from anon;
    grant execute on function person_other_companies(uuid) to authenticated, service_role;
  end if;
end $$;
