-- =====================================================================
--  Inventori syarikat (membesarkan company_assets)
--  - Item dipegang pekerja (employment_id) ATAU hanya mempunyai lokasi (cth. "Pejabat Seri Kembangan").
--  - Pekerja merekod sendiri: gambar (kamera / muat naik), butiran, harga, resit (pilihan).
--    Rekod pekerja = 'pending' sehingga HR mengesahkan; rekod HR terus 'verified'.
--  - HR melihat semua item syarikat, jumlah nilai, sahkan / tolak, tanda dipulangkan.
--  - Fail disimpan dalam bucket peribadi (folder pemuat naik); HR syarikat & pemegang item boleh membaca.
-- =====================================================================

alter table company_assets alter column employment_id drop not null;
alter table company_assets add column if not exists company_id     uuid references companies(id) on delete cascade;
alter table company_assets add column if not exists location       text;
alter table company_assets add column if not exists brand_model    text;
alter table company_assets add column if not exists price          numeric(12,2) check (price is null or price >= 0);
alter table company_assets add column if not exists condition      text not null default 'baik' check (condition in ('baik','rosak','hilang'));
alter table company_assets add column if not exists photo_paths    text[] not null default '{}';
alter table company_assets add column if not exists receipt_paths  text[] not null default '{}';
alter table company_assets add column if not exists status         text not null default 'verified' check (status in ('pending','verified','rejected'));
alter table company_assets add column if not exists reject_reason  text;
alter table company_assets add column if not exists created_by     uuid references persons(id);
alter table company_assets add column if not exists verified_by    uuid references persons(id);
alter table company_assets add column if not exists verified_at    timestamptz;
alter table company_assets add column if not exists updated_at     timestamptz not null default now();

update company_assets a set company_id = e.company_id from employments e where e.id = a.employment_id and a.company_id is null;

-- company_id sentiasa diisi (daripada pemegang jika tidak diberi)
create or replace function trg_company_assets_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is null and new.employment_id is not null then
    select company_id into new.company_id from employments where id = new.employment_id;
  end if;
  if new.company_id is null then raise exception 'Syarikat item tidak diketahui'; end if;
  if new.employment_id is null and coalesce(trim(new.location), '') = '' then
    raise exception 'Nyatakan pemegang atau lokasi item';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists company_assets_company on company_assets;
create trigger company_assets_company before insert or update on company_assets
  for each row execute function trg_company_assets_company();
alter table company_assets alter column company_id set not null;
create index if not exists company_assets_company on company_assets(company_id, status);

-- RLS: HR/Pentadbir syarikat (baca & tulis); pemegang & perekod (baca sahaja; tulis melalui RPC)
drop policy if exists company_assets_read on company_assets;
drop policy if exists company_assets_write on company_assets;
create policy company_assets_read on company_assets for select to authenticated using (
  has_role(company_id, '{hr,admin}')
  or (employment_id is not null and own_or_hr_employment(employment_id))
  or created_by = current_person_id());
create policy company_assets_write on company_assets for all to authenticated
  using (has_role(company_id, '{hr,admin}'))
  with check (has_role(company_id, '{hr,admin}'));

-- ---------------------------------------------------------------- Simpan item
create or replace function inventory_save(p_company uuid, p_data jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare d jsonb := coalesce(p_data, '{}'); me uuid := current_person_id(); hr boolean; emp_saya uuid;
        a company_assets; pemegang uuid; fail text; nama text; harga numeric; baru boolean := p_id is null; r record;
begin
  hr := has_role(p_company, '{hr,admin}');
  select id into emp_saya from employments where person_id = me and company_id = p_company and status in ('probation','active') limit 1;
  if not hr and emp_saya is null then raise exception 'Tidak dibenarkan'; end if;
  nama := left(trim(coalesce(d->>'name', '')), 120);
  if nama = '' then raise exception 'Sila namakan item'; end if;
  harga := nullif(d->>'price', '')::numeric;
  if harga is not null and (harga < 0 or harga > 10000000) then raise exception 'Harga tidak sah'; end if;
  if coalesce(d->>'condition', 'baik') not in ('baik','rosak','hilang') then raise exception 'Keadaan tidak sah'; end if;

  -- Pemegang: HR boleh pilih mana-mana pekerja syarikat; pekerja hanya diri sendiri atau tiada (lokasi sahaja)
  pemegang := nullif(d->>'employment_id', '')::uuid;
  if pemegang is not null and not exists (select 1 from employments where id = pemegang and company_id = p_company) then
    raise exception 'Pemegang tidak sah';
  end if;
  if not hr and pemegang is not null and pemegang <> emp_saya then raise exception 'Pekerja hanya boleh merekod item yang dipegang sendiri'; end if;

  -- Fail: pekerja hanya boleh melampirkan fail dalam folder sendiri
  if not hr then
    for fail in select jsonb_array_elements_text(coalesce(d->'photo_paths', '[]') || coalesce(d->'receipt_paths', '[]')) loop
      if split_part(fail, '/', 1) <> me::text then raise exception 'Fail tidak sah'; end if;
    end loop;
  end if;
  if jsonb_array_length(coalesce(d->'photo_paths', '[]')) > 6 or jsonb_array_length(coalesce(d->'receipt_paths', '[]')) > 6 then
    raise exception 'Maksimum 6 fail bagi setiap jenis';
  end if;

  if p_id is not null then
    select * into a from company_assets where id = p_id and company_id = p_company for update;
    if a.id is null then raise exception 'Item tidak dijumpai'; end if;
    if not hr and not (a.created_by = me and a.status in ('pending','rejected')) then
      raise exception 'Item ini telah disahkan. Hubungi HR untuk mengubahnya.';
    end if;
    update company_assets set
      name = nama, category = nullif(trim(d->>'category'), ''), brand_model = left(nullif(trim(d->>'brand_model'), ''), 120),
      serial_no = left(nullif(trim(d->>'serial_no'), ''), 80), issued_on = nullif(d->>'issued_on', '')::date,
      price = harga, condition = coalesce(d->>'condition', 'baik'), location = left(nullif(trim(d->>'location'), ''), 120),
      note = left(nullif(trim(d->>'note'), ''), 1000), employment_id = pemegang,
      photo_paths = array(select jsonb_array_elements_text(coalesce(d->'photo_paths', '[]'))),
      receipt_paths = array(select jsonb_array_elements_text(coalesce(d->'receipt_paths', '[]'))),
      status = case when hr then status else 'pending' end,
      reject_reason = case when hr then reject_reason end
     where id = p_id;
  else
    insert into company_assets(company_id, employment_id, name, category, brand_model, serial_no, issued_on, price, condition,
                               location, note, photo_paths, receipt_paths, status, created_by, verified_by, verified_at)
    values (p_company, pemegang, nama, nullif(trim(d->>'category'), ''), left(nullif(trim(d->>'brand_model'), ''), 120),
            left(nullif(trim(d->>'serial_no'), ''), 80), nullif(d->>'issued_on', '')::date, harga, coalesce(d->>'condition', 'baik'),
            left(nullif(trim(d->>'location'), ''), 120), left(nullif(trim(d->>'note'), ''), 1000),
            array(select jsonb_array_elements_text(coalesce(d->'photo_paths', '[]'))),
            array(select jsonb_array_elements_text(coalesce(d->'receipt_paths', '[]'))),
            case when hr then 'verified' else 'pending' end, me,
            case when hr then me end, case when hr then now() end)
    returning id into p_id;
  end if;

  -- Rekod pekerja (baharu / dihantar semula) → maklum HR
  if not hr then
    for r in select distinct ur.person_id from user_roles ur where ur.company_id = p_company and ur.role in ('hr','admin') and ur.person_id <> me loop
      perform notify_person(r.person_id, p_company,
        (select coalesce(preferred_name, full_name) from persons where id = me) || ' merekod item inventori "' || nama ||
        '". Sila semak dan sahkan di HRBoost → Pekerja → Inventori.');
    end loop;
  end if;
  return p_id;
end $$;

-- ---------------------------------------------------------------- HR: sahkan / tolak, pulang, padam
create or replace function hr_inventory_verify(p_id uuid, p_ok boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a company_assets;
begin
  select * into a from company_assets where id = p_id for update;
  if a.id is null or not has_role(a.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if not p_ok and coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  update company_assets set status = case when p_ok then 'verified' else 'rejected' end,
         reject_reason = case when p_ok then null else left(trim(p_reason), 500) end,
         verified_by = current_person_id(), verified_at = now()
   where id = a.id;
  if a.created_by is not null and a.created_by <> current_person_id() then
    perform notify_person(a.created_by, a.company_id,
      case when p_ok then 'Item inventori "' || a.name || '" telah disahkan oleh HR.'
           else 'Item inventori "' || a.name || '" dikembalikan oleh HR: ' || left(trim(p_reason), 300) || '. Sila betulkan di HRBoost → Saya → Inventori saya.' end);
  end if;
end $$;

create or replace function hr_inventory_return(p_id uuid, p_date date default current_date) returns void
language plpgsql security definer set search_path = public as $$
declare a company_assets;
begin
  select * into a from company_assets where id = p_id for update;
  if a.id is null or not has_role(a.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update company_assets set returned_on = p_date where id = a.id;
end $$;

create or replace function inventory_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a company_assets;
begin
  select * into a from company_assets where id = p_id for update;
  if a.id is null then raise exception 'Item tidak dijumpai'; end if;
  if not (has_role(a.company_id, '{hr,admin}') or (a.created_by = current_person_id() and a.status in ('pending','rejected'))) then
    raise exception 'Item ini telah disahkan. Hubungi HR untuk membuangnya.';
  end if;
  delete from company_assets where id = a.id;
end $$;

-- ---------------------------------------------------------------- Senarai
-- p_scope: 'mine' (dipegang / direkod oleh saya) atau 'all' (HR / Pentadbir / CEO / Kewangan)
create or replace function inventory_list(p_company uuid, p_scope text default 'mine')
returns table(id uuid, name text, category text, brand_model text, serial_no text, issued_on date, returned_on date,
              price numeric, condition text, location text, note text, photo_paths text[], receipt_paths text[],
              status text, reject_reason text, employment_id uuid, holder text, department text,
              created_by_name text, created_at timestamptz, verified_at timestamptz, editable boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := current_person_id(); hr boolean := has_role(p_company, '{hr,admin}');
begin
  if p_scope = 'all' and not has_role(p_company, '{hr,admin,ceo,finance}') then raise exception 'Tidak dibenarkan'; end if;
  if p_scope <> 'all' and not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  return query
    select a.id, a.name, a.category, a.brand_model, a.serial_no, a.issued_on, a.returned_on, a.price, a.condition, a.location, a.note,
           a.photo_paths, a.receipt_paths, a.status, a.reject_reason, a.employment_id,
           coalesce(p.preferred_name, p.full_name), d.name,
           (select coalesce(c.preferred_name, c.full_name) from persons c where c.id = a.created_by),
           a.created_at, a.verified_at,
           hr or (a.created_by = me and a.status in ('pending','rejected'))
      from company_assets a
      left join employments e on e.id = a.employment_id
      left join persons p on p.id = e.person_id
      left join departments d on d.id = e.department_id
     where a.company_id = p_company
       and (p_scope = 'all' or e.person_id = me or a.created_by = me)
     order by case a.status when 'pending' then 0 when 'rejected' then 1 else 2 end, a.returned_on nulls first, a.created_at desc;
end $$;

-- ---------------------------------------------------------------- Storan: pemegang / perekod boleh membaca gambar & resit item
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Skema storage tiada: polisi inventori dilangkau';
    return;
  end if;
  execute 'drop policy if exists peribadi_inventori_select on storage.objects';
  execute $p$
    create policy peribadi_inventori_select on storage.objects for select to authenticated
      using (bucket_id = 'peribadi' and exists (
        select 1 from public.company_assets a
          left join public.employments e on e.id = a.employment_id
         where storage.objects.name = any(a.photo_paths || a.receipt_paths)
           and (e.person_id = public.current_person_id() or a.created_by = public.current_person_id()
                or public.has_role(a.company_id, '{hr,admin,ceo,finance}'))))
  $p$;
end $$;

do $$
declare f text;
begin
  foreach f in array array['inventory_save(uuid,jsonb,uuid)','hr_inventory_verify(uuid,boolean,text)','hr_inventory_return(uuid,date)',
                           'inventory_delete(uuid)','inventory_list(uuid,text)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;

-- Terjemahan mesej
insert into message_i18n(kind, ms, en, sort) values
  ('message', $q$^(.+) merekod item inventori "(.+)"\. Sila semak dan sahkan di HRBoost → Pekerja → Inventori\.$$q$,
              $q$\1 recorded an inventory item "\2". Please review and verify it in HRBoost → Employees → Inventory.$q$, 670),
  ('message', $q$^Item inventori "(.+)" telah disahkan oleh HR\.$$q$,
              $q$Inventory item "\1" has been verified by HR.$q$, 671),
  ('message', $q$^Item inventori "(.+)" dikembalikan oleh HR: (.+)\. Sila betulkan di HRBoost → Saya → Inventori saya\.$$q$,
              $q$Inventory item "\1" was returned by HR: \2. Please correct it in HRBoost → Me → My inventory.$q$, 672)
on conflict (kind, ms) do nothing;
