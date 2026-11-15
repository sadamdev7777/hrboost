-- =====================================================================
--  Surat dikeluarkan oleh HR (dijana automatik daripada rekod pekerja):
--    offer               surat tawaran kerja
--    confirmation        surat pengesahan jawatan
--    probation_extension surat lanjutan tempoh percubaan
--    resignation_accept  surat terima peletakan jawatan (+ inventori belum dipulangkan)
--    experience          surat pengalaman kerja / pelepasan
--    salary_increment    surat kenaikan gaji
--    warning             surat amaran
--    show_cause          surat tunjuk sebab
--    salary_advance      memo pendahuluan gaji kepada Kewangan (rekod dalaman, tidak dilihat pekerja)
--  Surat atas permintaan pekerja (employment, salary) kekal melalui request_letter / issue_letter.
-- =====================================================================

alter table letter_requests drop constraint if exists letter_requests_kind_check;
alter table letter_requests add constraint letter_requests_kind_check check (kind in (
  'employment','salary','offer','confirmation','probation_extension','resignation_accept','experience',
  'salary_increment','warning','show_cause','salary_advance'));
alter table letter_requests add column if not exists source text not null default 'employee' check (source in ('employee','hr'));
alter table letter_requests add column if not exists details jsonb not null default '{}';
alter table letter_requests add column if not exists visible_to_employee boolean not null default true;
alter table letter_requests add column if not exists salary_advance_id uuid references salary_advances(id) on delete set null;

-- Kewangan boleh membaca memo pendahuluan gaji
drop policy if exists read_letter on letter_requests;
create policy read_letter on letter_requests for select using (
  has_role(company_id, '{hr,admin}')
  or (kind = 'salary_advance' and has_role(company_id, '{finance}'))
  or (visible_to_employee and exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id())));

-- Label surat (Bahasa Melayu; diterjemah di aplikasi & melalui message_i18n)
create or replace function letter_kind_label(p_kind text) returns text
language sql immutable set search_path = public as $$
  select case p_kind
    when 'employment' then 'Surat pengesahan majikan'
    when 'salary' then 'Surat pengesahan gaji'
    when 'offer' then 'Surat tawaran kerja'
    when 'confirmation' then 'Surat pengesahan jawatan'
    when 'probation_extension' then 'Surat lanjutan tempoh percubaan'
    when 'resignation_accept' then 'Surat terima peletakan jawatan'
    when 'experience' then 'Surat pengalaman kerja'
    when 'salary_increment' then 'Surat kenaikan gaji'
    when 'warning' then 'Surat amaran'
    when 'show_cause' then 'Surat tunjuk sebab'
    when 'salary_advance' then 'Memo pendahuluan gaji'
    else p_kind end
$$;

-- No. rujukan berturutan setiap syarikat setiap tahun: KOD/HR/YYYY/0001
create or replace function letter_next_ref(p_company uuid) returns text
language plpgsql security definer set search_path = public as $$
declare seq int;
begin
  perform pg_advisory_xact_lock(hashtext('letter_ref:' || p_company::text));
  select count(*) + 1 into seq from letter_requests where company_id = p_company and ref_no is not null
     and extract(year from issued_at) = extract(year from now());
  return (select code from companies where id = p_company) || '/HR/' || to_char(now(), 'YYYY') || '/' || lpad(seq::text, 4, '0');
end $$;

create or replace function letter_signatory(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', coalesce(pe.full_name, pe.preferred_name), 'position', coalesce(po.title, 'Pengurus Sumber Manusia'))
    from persons pe left join employments em on em.person_id = pe.id and em.company_id = p_company and em.status in ('probation','active')
    left join positions po on po.id = em.position_id
   where pe.id = current_person_id() limit 1
$$;

-- Data surat (dibina semasa dikeluarkan, kemudian dibekukan)
create or replace function letter_build_snapshot(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l letter_requests; e employments; p persons; c companies; gaji numeric; elaun numeric; hasil jsonb;
        baru employment_compensation; lama employment_compensation; adv salary_advances; tahun int := extract(year from current_date);
begin
  select * into l from letter_requests where id = p_id;
  select * into e from employments where id = l.employment_id;
  select * into p from persons where id = e.person_id;
  select * into c from companies where id = l.company_id;
  -- gaji semasa (atau gaji pada tarikh mula bagi pekerja yang belum mula)
  select coalesce(sum(ec.amount) filter (where pc.code = 'BASIC'), 0), coalesce(sum(ec.amount) filter (where pc.code <> 'BASIC' and pc.kind = 'earning'), 0)
    into gaji, elaun
    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
   where ec.employment_id = e.id and ec.effective_from <= greatest(current_date, e.join_date)
     and (ec.effective_to is null or ec.effective_to >= greatest(current_date, e.join_date));
  hasil := jsonb_build_object(
    'company', jsonb_build_object('name', c.name, 'reg_no', c.reg_no, 'address', c.address),
    'full_name', p.full_name, 'ic_no', p.ic_no, 'address', p.address, 'employee_no', e.employee_no,
    'position', (select title from positions where id = e.position_id),
    'department', (select name from departments where id = e.department_id),
    'join_date', e.join_date, 'employment_type', e.employment_type, 'status', e.status,
    'basic', case when l.kind in ('salary','offer','confirmation') then gaji end,
    'allowances', case when l.kind in ('salary','offer','confirmation') then elaun end);

  if l.kind in ('offer','confirmation','probation_extension') then
    hasil := hasil || jsonb_build_object('probation_end_date', e.probation_end_date);
  end if;
  if l.kind = 'offer' then
    hasil := hasil || jsonb_build_object(
      'work_schedule', c.work_schedule, 'work_start', to_char(c.work_start, 'HH24:MI'), 'work_end', to_char(c.work_end, 'HH24:MI'),
      'weekend_days', to_jsonb(c.weekend_days),
      'leave', (select coalesce(jsonb_object_agg(lt.code, coalesce(
                   (select lb.entitled from leave_balances lb where lb.employment_id = e.id and lb.leave_type_id = lt.id and lb.year = tahun),
                   (select r.days_per_year from leave_entitlement_rules r where r.leave_type_id = lt.id and r.min_service_months = 0 limit 1))), '{}')
                  from leave_types lt where lt.company_id = c.id and lt.code in ('AL','MC')));
  end if;
  if l.kind in ('resignation_accept','experience') then
    hasil := hasil || jsonb_build_object('end_date', e.end_date, 'end_status', e.end_status);
  end if;
  if l.kind = 'resignation_accept' then
    hasil := hasil || jsonb_build_object('assets', (
      select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'serial_no', a.serial_no, 'category', a.category) order by a.name), '[]')
        from company_assets a where a.employment_id = e.id and a.returned_on is null and a.status <> 'rejected'));
  end if;
  if l.kind = 'salary_increment' then
    select ec.* into baru from employment_compensation ec join pay_components pc on pc.id = ec.component_id
     where ec.employment_id = e.id and pc.code = 'BASIC' order by ec.effective_from desc limit 1;
    select ec.* into lama from employment_compensation ec join pay_components pc on pc.id = ec.component_id
     where ec.employment_id = e.id and pc.code = 'BASIC' and ec.id <> baru.id and ec.effective_from < baru.effective_from
     order by ec.effective_from desc limit 1;
    hasil := hasil || jsonb_build_object('old_basic', lama.amount, 'new_basic', baru.amount, 'increment_from', baru.effective_from);
  end if;
  if l.kind = 'salary_advance' then
    select * into adv from salary_advances where id = l.salary_advance_id;
    hasil := hasil || jsonb_build_object('advance', jsonb_build_object(
      'amount', adv.amount, 'reason', adv.reason, 'requested_at', adv.created_at, 'deduct_year', adv.deduct_year, 'deduct_month', adv.deduct_month,
      'disbursed_at', adv.disbursed_at,
      'approvers', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(ap.preferred_name, ap.full_name), 'step', t.step_name, 'at', t.acted_at)
                                              order by t.step_order), '[]')
                      from approval_tasks t join persons ap on ap.id = t.approver_person_id
                     where t.request_id = adv.approval_request_id and t.status = 'approved'),
      'bank', p.bank_name));
  end if;
  return hasil;
end $$;

-- HR mengeluarkan surat terus (tiada permohonan pekerja)
create or replace function hr_issue_letter(p_employment uuid, p_kind text, p_details jsonb default '{}', p_addressed_to text default null,
                                           p_salary_advance uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare e employments; d jsonb := coalesce(p_details, '{}'); nid uuid; ruj text; adv salary_advances; nama text; label text; f record;
begin
  select * into e from employments where id = p_employment;
  if e.id is null then raise exception 'Pekerja tidak dijumpai'; end if;
  if p_kind = 'salary_advance' then
    if not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan / Pentadbir'; end if;
  elsif not has_role(e.company_id, '{hr,admin}') then
    raise exception 'Hanya HR / Pentadbir';
  end if;
  if p_kind not in ('offer','confirmation','probation_extension','resignation_accept','experience','salary_increment','warning','show_cause','salary_advance') then
    raise exception 'Jenis surat tidak sah';
  end if;

  -- syarat setiap jenis surat
  if p_kind in ('offer','confirmation','probation_extension','salary_increment','warning','show_cause') and e.status not in ('probation','active') then
    raise exception 'Pekerjaan ini tidak aktif';
  end if;
  if p_kind = 'probation_extension' then
    if nullif(d->>'new_end_date', '') is null then raise exception 'Sila nyatakan tarikh tamat percubaan yang baharu'; end if;
    if e.probation_end_date is not null and (d->>'new_end_date')::date <= e.probation_end_date and e.status = 'probation'
       and coalesce(d->>'old_end_date', '') = '' then
      raise exception 'Tarikh baharu mesti selepas tarikh tamat percubaan semasa';
    end if;
    d := d || jsonb_build_object('old_end_date', coalesce(nullif(d->>'old_end_date', ''), e.probation_end_date::text));
  end if;
  if p_kind = 'confirmation' then
    d := d || jsonb_build_object('effective_date', coalesce(nullif(d->>'effective_date', ''), e.probation_end_date::text, current_date::text));
  end if;
  if p_kind in ('resignation_accept','experience') and e.end_date is null then
    raise exception 'Tetapkan hari bekerja terakhir dahulu (Tamatkan pekerjaan)';
  end if;
  if p_kind = 'salary_increment' and (select count(*) from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                                       where ec.employment_id = e.id and pc.code = 'BASIC') < 2 then
    raise exception 'Tiada rekod kenaikan gaji pokok. Kemas kini gaji pekerja dahulu';
  end if;
  if p_kind in ('warning','show_cause') and length(trim(coalesce(d->>'description', ''))) < 20 then
    raise exception 'Sila nyatakan butiran salah laku (sekurang-kurangnya 20 aksara)';
  end if;
  if p_kind = 'show_cause' and nullif(d->>'reply_by', '') is null then
    raise exception 'Sila nyatakan tarikh akhir jawapan bertulis';
  end if;
  if p_kind = 'salary_advance' then
    select * into adv from salary_advances where id = p_salary_advance and employment_id = e.id;
    if adv.id is null or adv.status <> 'approved' then raise exception 'Pendahuluan gaji belum diluluskan'; end if;
  end if;

  -- bersihkan medan teks
  for f in select key, value from jsonb_each(d) loop
    if jsonb_typeof(f.value) = 'string' then d := d || jsonb_build_object(f.key, left(trim(f.value #>> '{}'), 2000)); end if;
  end loop;

  label := letter_kind_label(p_kind);
  ruj := letter_next_ref(e.company_id);
  insert into letter_requests(company_id, employment_id, kind, purpose, addressed_to, status, ref_no, issued_at, issued_by,
                              source, details, visible_to_employee, salary_advance_id)
  values (e.company_id, e.id, p_kind, label, nullif(trim(coalesce(p_addressed_to, '')), ''), 'issued', ruj, now(), current_person_id(),
          'hr', d, p_kind <> 'salary_advance', adv.id)
  returning id into nid;
  update letter_requests set snapshot = letter_build_snapshot(nid) || jsonb_build_object('signatory', letter_signatory(e.company_id))
   where id = nid;

  if p_kind in ('offer','confirmation','salary_increment','salary_advance') then
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'salary_letter', 'web');
  end if;

  select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
  if p_kind = 'salary_advance' then
    for f in select distinct ur.person_id from user_roles ur
               join employments x on x.person_id = ur.person_id and x.company_id = e.company_id and x.status in ('probation','active')
              where ur.company_id = e.company_id and ur.role = 'finance' and ur.person_id <> current_person_id() loop
      perform notify_person(f.person_id, e.company_id,
        'Memo pendahuluan gaji ' || nama || ' (RM' || to_char(adv.amount, 'FM999,999,990.00') || ') telah dikeluarkan oleh HR (' || ruj || '). Lihat di HRBoost → Gaji → Pendahuluan.');
    end loop;
  else
    perform notify_person(e.person_id, e.company_id,
      'HR telah mengeluarkan ' || lower(label) || ' untuk anda (' || ruj || '). Lihat di HRBoost → Mohon → Surat.');
  end if;
  return nid;
end $$;

-- Senarai surat syarikat (HR) atau surat saya (pekerja)
drop function if exists letter_list(uuid, boolean);
create or replace function letter_list(p_company uuid, p_mine boolean default false)
returns table(id uuid, employment_id uuid, name text, employee_no text, kind text, purpose text, addressed_to text, status text,
              ref_no text, issued_at timestamptz, reject_reason text, created_at timestamptz, source text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not p_mine and not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select l.id, l.employment_id, coalesce(p.preferred_name, p.full_name), e.employee_no, l.kind, l.purpose, l.addressed_to, l.status,
         l.ref_no, l.issued_at, l.reject_reason, l.created_at, l.source
    from letter_requests l join employments e on e.id = l.employment_id join persons p on p.id = e.person_id
   where l.company_id = p_company
     and (not p_mine or (e.person_id = current_person_id() and l.visible_to_employee))
   order by (l.status = 'pending') desc, coalesce(l.issued_at, l.created_at) desc
   limit 300;
end $$;

-- Surat bagi seorang pekerja (profil pekerja — HR)
create or replace function letter_list_employment(p_employment uuid)
returns table(id uuid, kind text, purpose text, status text, ref_no text, issued_at timestamptz, created_at timestamptz, source text,
              issued_by text, salary_advance_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments x where x.id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin,finance}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select l.id, l.kind, l.purpose, l.status, l.ref_no, l.issued_at, l.created_at, l.source,
         coalesce(p.preferred_name, p.full_name), l.salary_advance_id
    from letter_requests l left join persons p on p.id = l.issued_by
   where l.employment_id = e.id
     and (has_role(e.company_id, '{hr,admin}') or l.kind = 'salary_advance')
   order by coalesce(l.issued_at, l.created_at) desc;
end $$;

create or replace function letter_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l letter_requests; e employments;
begin
  select * into l from letter_requests where id = p_id;
  select * into e from employments where id = l.employment_id;
  if l.id is null or l.status <> 'issued' or not (
       has_role(l.company_id, '{hr,admin}')
       or (l.kind = 'salary_advance' and has_role(l.company_id, '{finance}'))
       or (l.visible_to_employee and e.person_id = current_person_id())) then
    raise exception 'Surat tidak dijumpai';
  end if;
  return l.snapshot || jsonb_build_object('kind', l.kind, 'purpose', l.purpose, 'addressed_to', l.addressed_to, 'ref_no', l.ref_no,
    'issued_at', l.issued_at, 'source', l.source, 'details', l.details, 'logo_path', (select logo_path from companies where id = l.company_id));
end $$;

-- Garis masa pekerja: label surat ikut jenis
create or replace function employment_history(p_employment uuid, p_include_access boolean default false)
returns table(at timestamptz, kind text, field text, old_value text, new_value text, note text, actor text)
language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select * from (
    select c.changed_at, 'change'::text, c.field, c.old_value, c.new_value, c.note, coalesce(p.preferred_name, p.full_name)
      from employment_changes c left join persons p on p.id = c.changed_by where c.employment_id = e.id
    union all
    select e.created_at, 'event', 'joined', null, e.join_date::text, null, null::text
    union all
    select l.issued_at, 'event', 'letter', null, l.ref_no, letter_kind_label(l.kind), coalesce(p.preferred_name, p.full_name)
      from letter_requests l left join persons p on p.id = l.issued_by where l.employment_id = e.id and l.status = 'issued'
    union all
    select r.submitted_at, 'event', 'probation_review', null, r.recommendation, r.comments, coalesce(p.preferred_name, p.full_name)
      from probation_reviews r join persons p on p.id = r.reviewer_id where r.employment_id = e.id
    union all
    select d.created_at, 'event', 'document', null, d.title, d.doc_type, coalesce(p.preferred_name, p.full_name)
      from employee_documents d left join persons p on p.id = d.uploaded_by where d.employment_id = e.id
    union all
    select a.created_at, 'access', a.resource, null, null, a.via::text, coalesce(p.preferred_name, p.full_name)
      from data_access_log a left join persons p on p.id = a.actor_person_id
     where p_include_access and a.subject_person_id = e.person_id
  ) x order by 1 desc limit 300;
end $$;

-- Senarai pendahuluan gaji: sertakan memo yang telah dikeluarkan
drop function if exists hr_salary_advances(uuid);
create or replace function hr_salary_advances(p_company uuid)
returns table(id uuid, employment_id uuid, name text, amount numeric, reason text, status request_status, deduct_year int, deduct_month int,
              disbursed_at timestamptz, deducted boolean, created_at timestamptz, memo_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select a.id, a.employment_id, coalesce(p.preferred_name, p.full_name), a.amount, a.reason, a.status, a.deduct_year, a.deduct_month,
         a.disbursed_at, a.deducted_via_payroll_run is not null, a.created_at,
         (select l.id from letter_requests l where l.salary_advance_id = a.id and l.status = 'issued' order by l.issued_at desc limit 1)
    from salary_advances a join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
   where e.company_id = p_company and a.status in ('pending','approved')
   order by a.created_at desc limit 100;
end $$;

-- Mesej notifikasi (English)
insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^HR telah mengeluarkan (.+) untuk anda \((.+)\)\. Lihat di HRBoost → Mohon → Surat\.$$q$,
              $q$HR has issued a \1 for you (\2). View it in HRBoost → Apply → Letters.$q$, 680, true),
  ('message', $q$^Memo pendahuluan gaji (.+) \(RM(\S+)\) telah dikeluarkan oleh HR \((.+)\)\. Lihat di HRBoost → Gaji → Pendahuluan\.$$q$,
              $q$Salary advance memo for \1 (RM\2) has been issued by HR (\3). View it in HRBoost → Payroll → Advances.$q$, 681, false),
  ('phrase', 'surat tawaran kerja', 'job offer letter', 0, true),
  ('phrase', 'surat pengesahan jawatan', 'confirmation of employment letter', 0, true),
  ('phrase', 'surat lanjutan tempoh percubaan', 'probation extension letter', 0, true),
  ('phrase', 'surat terima peletakan jawatan', 'resignation acceptance letter', 0, true),
  ('phrase', 'surat pengalaman kerja', 'experience letter', 0, true),
  ('phrase', 'surat kenaikan gaji', 'salary increment letter', 0, true),
  ('phrase', 'surat amaran', 'warning letter', 0, true),
  ('phrase', 'surat tunjuk sebab', 'show cause letter', 0, true)
on conflict (kind, ms) do update set en = excluded.en, sort = excluded.sort, frasa = excluded.frasa;

do $$
declare f text;
begin
  foreach f in array array['letter_kind_label(text)', 'letter_next_ref(uuid)', 'letter_signatory(uuid)', 'letter_build_snapshot(uuid)',
    'hr_issue_letter(uuid, text, jsonb, text, uuid)', 'letter_list(uuid, boolean)', 'letter_list_employment(uuid)', 'letter_view(uuid)',
    'employment_history(uuid, boolean)', 'hr_salary_advances(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f in ('hr_issue_letter(uuid, text, jsonb, text, uuid)', 'letter_list(uuid, boolean)', 'letter_list_employment(uuid)',
               'letter_view(uuid)', 'employment_history(uuid, boolean)', 'letter_kind_label(text)', 'hr_salary_advances(uuid)') then
        execute format('grant execute on function %s to authenticated, service_role', f);
      else
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      end if;
    end if;
  end loop;
end $$;
