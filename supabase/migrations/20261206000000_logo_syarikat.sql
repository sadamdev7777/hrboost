-- Logo syarikat: dimuat naik oleh HR / Pentadbir (Tetapan → Profil Syarikat, seret & lepas),
-- dipaparkan pada surat rasmi, slip gaji, menu HR dan panel Pentadbir Platform.
-- Logo bukan data peribadi, jadi disimpan dalam bucket awam `logo` (folder = id syarikat).

-- 1. Bucket awam `logo` (≤ 1 MB, PNG / JPEG / WebP sahaja — tiada SVG untuk elak skrip terbenam)
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Skema storage tiada: bucket logo dilangkau';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logo', 'logo', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists logo_hr_insert on storage.objects;
  drop policy if exists logo_hr_update on storage.objects;
  drop policy if exists logo_hr_delete on storage.objects;
  drop policy if exists logo_hr_select on storage.objects;
  -- Hanya HR / Pentadbir syarikat itu boleh menulis ke folder <company_id>/
  execute $p$
    create policy logo_hr_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'logo' and exists (select 1 from public.companies c where c.id::text = (storage.foldername(storage.objects.name))[1] and public.has_role(c.id, '{hr,admin}')))
  $p$;
  execute $p$
    create policy logo_hr_update on storage.objects for update to authenticated
      using (bucket_id = 'logo' and exists (select 1 from public.companies c where c.id::text = (storage.foldername(storage.objects.name))[1] and public.has_role(c.id, '{hr,admin}')))
  $p$;
  execute $p$
    create policy logo_hr_delete on storage.objects for delete to authenticated
      using (bucket_id = 'logo' and exists (select 1 from public.companies c where c.id::text = (storage.foldername(storage.objects.name))[1] and public.has_role(c.id, '{hr,admin}')))
  $p$;
  execute $p$
    create policy logo_hr_select on storage.objects for select to authenticated
      using (bucket_id = 'logo' and exists (select 1 from public.companies c where c.id::text = (storage.foldername(storage.objects.name))[1] and public.has_role(c.id, '{hr,admin}')))
  $p$;
end $$;

-- 2. Tetapkan / buang logo syarikat
create or replace function set_company_logo(p_company uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if p_path is not null and (p_path not like p_company::text || '/%' or p_path ~ '\.\.') then
    raise exception 'Laluan logo tidak sah';
  end if;
  update companies set logo_path = p_path where id = p_company;
end $$;

-- 3. Surat: sertakan logo semasa syarikat
create or replace function letter_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l letter_requests; e employments;
begin
  select * into l from letter_requests where id = p_id;
  select * into e from employments where id = l.employment_id;
  if l.id is null or l.status <> 'issued' or not (has_role(l.company_id, '{hr,admin}') or e.person_id = current_person_id()) then
    raise exception 'Surat tidak dijumpai';
  end if;
  return l.snapshot || jsonb_build_object('kind', l.kind, 'purpose', l.purpose, 'addressed_to', l.addressed_to, 'ref_no', l.ref_no, 'issued_at', l.issued_at,
    'logo_path', (select logo_path from companies where id = l.company_id));
end $$;

-- 4. Slip gaji: sertakan logo dalam maklumat syarikat
create or replace function payslip_meta(p_payslip uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('period_year', r.period_year, 'period_month', r.period_month, 'pay_date', r.pay_date,
           'status', r.status, 'company', jsonb_build_object('name', c.name, 'code', c.code, 'reg_no', c.reg_no,
           'epf', c.epf_employer_no, 'socso', c.socso_employer_no, 'lhdn', c.lhdn_employer_no, 'logo_path', c.logo_path))
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join companies c on c.id = r.company_id
    join employments e on e.id = s.employment_id
   where s.id = p_payslip
     and ((e.person_id = current_person_id() and payslip_visible_status(r))
          or has_role(r.company_id, '{hr,finance,ceo,admin}'))
$$;

-- 5. Pentadbir Platform: logo setiap syarikat (bukan data peribadi)
create or replace function sa_company_logos() returns table(company_id uuid, logo_path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya Pentadbir Platform'; end if;
  return query select c.id, c.logo_path from companies c where c.logo_path is not null;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function set_company_logo(uuid, text) from public, anon;
    grant execute on function set_company_logo(uuid, text) to authenticated;
    revoke all on function sa_company_logos() from public, anon;
    grant execute on function sa_company_logos() to authenticated;
  end if;
end $$;
