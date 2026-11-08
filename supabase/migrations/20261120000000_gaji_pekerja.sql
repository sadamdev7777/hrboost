-- =====================================================================
--  Gaji Pekerja: tetapkan gaji pokok & elaun / potongan tetap bagi semua
--  pekerja dalam satu jadual (HR / Kewangan / Pentadbir).
--  Komponen berubah-ubah (komisen, kerja lebih masa, tuntutan, cuti tanpa
--  gaji) tidak di sini — ia dimasukkan setiap bulan dalam Proses Gaji.
--  Setiap paparan / perubahan gaji direkodkan dalam data_access_log.
-- =====================================================================

-- Komponen tetap = semua komponen syarikat kecuali yang berubah setiap bulan.
create or replace function pay_component_is_fixed(p_code text) returns boolean
language sql immutable as $$ select p_code not in ('COMMISSION','OT','CLAIM','UNPAID') $$;

-- Jadual gaji semasa (pada tarikh p_on) bagi semua pekerja aktif.
create or replace function hr_pay_table(p_company uuid, p_on date default null, p_via action_channel default 'web')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_on, (now() at time zone 'Asia/Kuala_Lumpur')::date); res jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;

  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'salary', p_via
    from employments e where e.company_id = p_company and e.status in ('probation','active');

  select jsonb_build_object(
    'on', d,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object('code', pc.code, 'name', pc.name, 'kind', pc.kind,
                                          'epf', pc.epf_applicable, 'socso', pc.socso_applicable, 'taxable', pc.taxable)
                       order by (pc.code <> 'BASIC'), pc.kind, pc.name)
        from pay_components pc where pc.company_id = p_company and pay_component_is_fixed(pc.code)), '[]'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employment_id', e.id,
               'name', coalesce(p.preferred_name, p.full_name),
               'employee_no', e.employee_no,
               'department', dp.name,
               'status', e.status,
               'join_date', e.join_date,
               'items', coalesce((
                  select jsonb_object_agg(pc.code, ec.amount)
                    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)), '{}'),
               'effective_from', (
                  select max(ec.effective_from) from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)),
               'upcoming', exists (
                  select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code) and ec.effective_from > d))
             order by dp.name nulls last, e.employee_no)
        from employments e
        join persons p on p.id = e.person_id
        left join departments dp on dp.id = e.department_id
       where e.company_id = p_company and e.status in ('probation','active')), '[]')
  ) into res;
  return res;
end $$;

-- Tetapkan komponen tetap seorang pekerja mulai p_effective_from.
-- p_items: {"BASIC": 3500, "ALLOWANCE": 200}. Amaun 0 = hentikan komponen itu mulai tarikh tersebut.
create or replace function hr_set_pay(p_employment uuid, p_items jsonb, p_effective_from date, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare e employments; k text; v jsonb; amt numeric; comp uuid; semasa numeric; berubah boolean := false;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini tidak aktif'; end if;
  if p_effective_from is null then raise exception 'Sila pilih tarikh berkuat kuasa'; end if;
  if p_effective_from < e.join_date then raise exception 'Tarikh berkuat kuasa tidak boleh sebelum tarikh mula bekerja (%)', to_char(e.join_date, 'DD/MM/YYYY'); end if;
  if jsonb_typeof(p_items) <> 'object' then raise exception 'Data gaji tidak sah'; end if;

  for k, v in select * from jsonb_each(p_items) loop
    if jsonb_typeof(v) <> 'number' then raise exception 'Amaun tidak sah bagi %', k; end if;
    amt := round((v #>> '{}')::numeric, 2);
    if amt < 0 or amt > 1000000 then raise exception 'Amaun tidak sah bagi %', k; end if;
    if k = 'BASIC' and amt <= 0 then raise exception 'Gaji pokok mesti lebih daripada RM0'; end if;
    select id into comp from pay_components where company_id = e.company_id and code = k and pay_component_is_fixed(code);
    if comp is null then raise exception 'Komponen gaji tidak sah: %', k; end if;

    select ec.amount into semasa from employment_compensation ec
     where ec.employment_id = e.id and ec.component_id = comp
       and ec.effective_from <= p_effective_from and (ec.effective_to is null or ec.effective_to >= p_effective_from)
     order by ec.effective_from desc limit 1;
    -- tiada perubahan & tiada rekod masa depan → langkau
    if coalesce(semasa, 0) = amt and not exists (
         select 1 from employment_compensation where employment_id = e.id and component_id = comp and effective_from > p_effective_from) then
      continue;
    end if;

    delete from employment_compensation where employment_id = e.id and component_id = comp and effective_from >= p_effective_from;
    update employment_compensation set effective_to = p_effective_from - 1
     where employment_id = e.id and component_id = comp and (effective_to is null or effective_to >= p_effective_from);
    if amt > 0 then
      insert into employment_compensation(employment_id, component_id, amount, effective_from) values (e.id, comp, amt, p_effective_from);
    end if;
    berubah := true;
  end loop;

  if berubah then
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'salary', p_via);
    perform emit_event(e.company_id, 'employment.updated', e.person_id, e.id,
                       jsonb_build_object('pay', true, 'effective_from', p_effective_from, 'via', p_via));
  end if;
end $$;

-- Tambah jenis elaun / potongan tetap syarikat (cth. Elaun Telefon).
create or replace function hr_add_pay_component(p_company uuid, p_name text, p_kind text,
                                                p_epf boolean default true, p_socso boolean default true, p_taxable boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare nm text := trim(coalesce(p_name, '')); c text; n int := 1;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if length(nm) < 3 or length(nm) > 60 then raise exception 'Nama komponen mesti 3–60 aksara'; end if;
  if p_kind not in ('earning','deduction') then raise exception 'Jenis tidak sah'; end if;
  if exists (select 1 from pay_components where company_id = p_company and lower(name) = lower(nm)) then
    raise exception 'Komponen "%" sudah wujud', nm;
  end if;
  c := 'X_' || left(upper(regexp_replace(nm, '[^A-Za-z0-9]+', '_', 'g')), 24);
  while exists (select 1 from pay_components where company_id = p_company and code = c) loop
    n := n + 1; c := left(c, 24) || '_' || n;
  end loop;
  insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable)
  values (p_company, c, nm, p_kind, coalesce(p_taxable, true), coalesce(p_epf, true), coalesce(p_socso, true));
  return c;
end $$;

revoke all on function hr_pay_table(uuid, date, action_channel) from public;
revoke all on function hr_set_pay(uuid, jsonb, date, action_channel) from public;
revoke all on function hr_add_pay_component(uuid, text, text, boolean, boolean, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function hr_pay_table(uuid, date, action_channel) from anon;
    revoke all on function hr_set_pay(uuid, jsonb, date, action_channel) from anon;
    revoke all on function hr_add_pay_component(uuid, text, text, boolean, boolean, boolean) from anon;
    grant execute on function hr_pay_table(uuid, date, action_channel) to authenticated, service_role;
    grant execute on function hr_set_pay(uuid, jsonb, date, action_channel) to authenticated, service_role;
    grant execute on function hr_add_pay_component(uuid, text, text, boolean, boolean, boolean) to authenticated, service_role;
  end if;
end $$;
