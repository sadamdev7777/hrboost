-- Profil pekerja lanjutan (setara dengan tab BrioHR yang belum ada dalam HRBoost):
--   1. Garis masa kerja (Job Timeline): setiap perubahan jawatan, jabatan, ketua, jenis pekerjaan & status, dengan tarikh berkuat kuasa
--   2. Keluarga (pasangan & anak) — untuk PCB dan rekod
--   3. Aset syarikat (Equipment): komputer riba, telefon, kad akses … yang dipegang pekerja
--   4. Latihan & sijil (Training & Certification), dengan tarikh tamat sijil
--   5. Warganegara pada persons
-- Semua jadual mengikut employments (satu syarikat). RLS: HR/Pentadbir menulis; pekerja sendiri & HR membaca.

alter table persons add column if not exists nationality text default 'MY';

-- 1. Garis masa kerja
create table if not exists job_timeline (
  id              uuid primary key default gen_random_uuid(),
  employment_id   uuid not null references employments(id) on delete cascade,
  effective_date  date not null,
  event           text not null check (event in ('started','promoted','transferred','changed','confirmed','type_changed','ended')),
  position        text,
  department      text,
  manager         text,
  employment_type text,
  note            text,
  source          text not null default 'system' check (source in ('system','hr','import')),
  created_by      uuid references persons(id),
  created_at      timestamptz not null default now()
);
create index if not exists job_timeline_emp on job_timeline(employment_id, effective_date desc);

-- 2. Keluarga
create table if not exists family_members (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  relation       text not null check (relation in ('spouse','child')),
  name           text not null check (length(trim(name)) between 1 and 120),
  ic_no          text,
  birth_date     date,
  working        boolean,
  disabled       boolean not null default false,
  studying       text check (studying in ('none','school','preu','higher')),
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists family_members_emp on family_members(employment_id);

-- 3. Aset syarikat
create table if not exists company_assets (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  category       text,
  serial_no      text,
  issued_on      date,
  returned_on    date,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists company_assets_emp on company_assets(employment_id);

-- 4. Latihan & sijil
create table if not exists trainings (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  kind           text not null check (kind in ('training','certification')),
  title          text not null check (length(trim(title)) between 1 and 160),
  provider       text,
  start_date     date,
  end_date       date,
  expiry_date    date,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists trainings_emp on trainings(employment_id);

-- RLS: pekerja sendiri & HR/Pentadbir membaca; HR/Pentadbir menulis.
-- Keluarga (no. KP anak/pasangan) tidak dibuka kepada ketua jabatan.
create or replace function own_or_hr_employment(p_employment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employments e where e.id = p_employment
                    and (e.person_id = current_person_id() or has_role(e.company_id, '{hr,admin}')))
$$;

do $$
declare t text;
begin
  foreach t in array array['job_timeline','family_members','company_assets','trainings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for select to authenticated using (own_or_hr_employment(employment_id))', t || '_read', t);
    execute format('create policy %I on %I for all to authenticated using (has_role(employment_company(employment_id), %L)) with check (has_role(employment_company(employment_id), %L))',
                   t || '_write', t, '{hr,admin}', '{hr,admin}');
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant select, insert, update, delete on %I to authenticated', t);
    end if;
  end loop;
end $$;

-- Garis masa kerja direkodkan secara automatik apabila pekerja ditambah atau jawatan/jabatan/ketua/jenis/status berubah
create or replace function trg_job_timeline() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text; jawatan text; jab text; ketua text;
begin
  select title into jawatan from positions where id = new.position_id;
  select name into jab from departments where id = new.department_id;
  select coalesce(preferred_name, full_name) into ketua from persons where id = new.manager_person_id;
  if tg_op = 'INSERT' then
    ev := 'started';
  elsif new.end_date is not null and old.end_date is null then
    ev := 'ended';
  elsif new.status = 'active' and old.status = 'probation' then
    ev := 'confirmed';
  elsif new.position_id is distinct from old.position_id and new.department_id is distinct from old.department_id then
    ev := 'transferred';
  elsif new.position_id is distinct from old.position_id then
    ev := 'promoted';
  elsif new.department_id is distinct from old.department_id then
    ev := 'transferred';
  elsif new.manager_person_id is distinct from old.manager_person_id then
    ev := 'changed';
  elsif new.employment_type is distinct from old.employment_type then
    ev := 'type_changed';
  else
    return new;
  end if;
  -- Import data lama menulis garis masa sendiri (source = 'import'); elak pendua
  if current_setting('hrboost.import', true) = 'on' then return new; end if;
  insert into job_timeline(employment_id, effective_date, event, position, department, manager, employment_type, source, created_by)
  values (new.id, case ev when 'started' then new.join_date when 'ended' then new.end_date else current_date end,
          ev, jawatan, jab, ketua, new.employment_type::text, 'system', current_person_id());
  return new;
end $$;
drop trigger if exists job_timeline_ins on employments;
drop trigger if exists job_timeline_upd on employments;
create trigger job_timeline_ins after insert on employments for each row execute function trg_job_timeline();
create trigger job_timeline_upd after update of position_id, department_id, manager_person_id, employment_type, status, end_date on employments
  for each row execute function trg_job_timeline();

-- Isi garis masa bagi pekerja sedia ada yang belum mempunyai sebarang rekod (titik mula)
insert into job_timeline(employment_id, effective_date, event, position, department, manager, employment_type, source)
select e.id, e.join_date, 'started', po.title, d.name, coalesce(m.preferred_name, m.full_name), e.employment_type::text, 'system'
  from employments e left join positions po on po.id = e.position_id left join departments d on d.id = e.department_id
  left join persons m on m.id = e.manager_person_id
 where not exists (select 1 from job_timeline j where j.employment_id = e.id);

-- Sijil hampir tamat (60 hari) — untuk senarai tugasan HR
create or replace function hr_expiring_certs(p_company uuid) returns table(employment_id uuid, name text, title text, expiry_date date)
language sql stable security definer set search_path = public as $$
  select t.employment_id, coalesce(p.preferred_name, p.full_name), t.title, t.expiry_date
    from trainings t join employments e on e.id = t.employment_id join persons p on p.id = e.person_id
   where e.company_id = p_company and has_role(p_company, '{hr,admin}') and t.kind = 'certification'
     and t.expiry_date between current_date and current_date + 60 and e.status in ('probation','active')
   order by t.expiry_date
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function trg_job_timeline() from public, anon, authenticated;
    revoke all on function hr_expiring_certs(uuid) from public, anon;
    grant execute on function hr_expiring_certs(uuid) to authenticated;
    grant execute on function own_or_hr_employment(uuid) to authenticated;
  end if;
end $$;

-- Maklumat peribadi: warganegara, e-mel peribadi & pasport
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
    'full_name', p.full_name, 'ic_no', p.ic_no, 'nationality', p.nationality, 'passport_no', p.passport_no, 'passport_expiry', p.passport_expiry, 'date_of_birth', p.date_of_birth, 'gender', p.gender,
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

create or replace function hr_update_person(p_employment uuid, p_data jsonb, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare
  e employments; p persons; tel text; ic text; ubah text[] := '{}';
  k text; en boolean;
  label_en constant jsonb := jsonb_build_object(
    'full_name', 'full name', 'preferred_name', 'preferred name', 'ic_no', 'IC number',
    'date_of_birth', 'date of birth', 'phone_whatsapp', 'WhatsApp number', 'address', 'address',
    'marital_status', 'marital status', 'spouse_working', 'spouse employment', 'children_count', 'number of children',
    'bank_name', 'bank', 'bank_account_no', 'bank account number', 'epf_no', 'EPF number', 'socso_no', 'SOCSO number', 'tax_no', 'tax number', 'nationality', 'nationality', 'email', 'personal email', 'passport_no', 'passport number');
  label constant jsonb := jsonb_build_object(
    'full_name', 'nama penuh', 'preferred_name', 'nama panggilan', 'ic_no', 'no. kad pengenalan',
    'date_of_birth', 'tarikh lahir', 'phone_whatsapp', 'nombor WhatsApp', 'address', 'alamat',
    'marital_status', 'status perkahwinan', 'spouse_working', 'status kerja pasangan', 'children_count', 'bilangan anak',
    'bank_name', 'bank', 'bank_account_no', 'no. akaun bank', 'epf_no', 'no. KWSP', 'socso_no', 'no. PERKESO', 'tax_no', 'no. cukai', 'nationality', 'warganegara', 'email', 'e-mel peribadi', 'passport_no', 'no. pasport');
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR syarikat ini'; end if;
  select * into p from persons where id = e.person_id for update;

  for k in select jsonb_object_keys(p_data) loop
    if not label ? k then raise exception 'Medan tidak dikenali: %', k; end if;
  end loop;

  if p_data ? 'full_name' and coalesce(trim(p_data->>'full_name'), '') = '' then raise exception 'Sila isi nama penuh'; end if;
  if p_data ? 'ic_no' then
    ic := nullif(regexp_replace(coalesce(p_data->>'ic_no', ''), '\D', '', 'g'), '');
    if ic is not null and ic !~ '^\d{12}$' then raise exception 'No. kad pengenalan mesti 12 digit'; end if;
  end if;
  if p_data ? 'phone_whatsapp' then
    tel := nullif(regexp_replace(coalesce(p_data->>'phone_whatsapp', ''), '\D', '', 'g'), '');
    if tel like '0%' then tel := '6' || tel; end if;
    if tel is not null and tel !~ '^601\d{8,9}$' then raise exception 'Nombor WhatsApp tidak sah'; end if;
  end if;
  if p_data ? 'marital_status' and coalesce(p_data->>'marital_status', '') not in ('', 'bujang', 'berkahwin', 'duda_janda') then
    raise exception 'Status perkahwinan tidak sah';
  end if;
  if p_data ? 'children_count' and coalesce((p_data->>'children_count')::int, 0) not between 0 and 30 then
    raise exception 'Bilangan anak tidak sah';
  end if;

  -- Senarai medan yang benar-benar berubah (untuk log & notifikasi)
  en := coalesce(p.language, 'en') = 'en';
  select coalesce(array_agg(case when en then label_en else label end ->> x.key order by x.ord), '{}') into ubah
    from (select j.key, j.value, array_position(array['full_name','preferred_name','ic_no','date_of_birth','phone_whatsapp','address',
                 'marital_status','spouse_working','children_count','bank_name','bank_account_no','epf_no','socso_no','tax_no','nationality','email','passport_no'], j.key) ord
            from jsonb_each(p_data) j) x
   where x.value is distinct from (case x.key
           when 'epf_no' then to_jsonb(e.epf_no) when 'socso_no' then to_jsonb(e.socso_no) when 'tax_no' then to_jsonb(e.tax_no)
           else to_jsonb(p) -> x.key end)
     and not (x.key = 'ic_no' and ic is not distinct from p.ic_no)
     and not (x.key = 'phone_whatsapp' and tel is not distinct from p.phone_whatsapp);
  if cardinality(ubah) = 0 then return; end if;

  begin
    update persons set
      full_name       = case when p_data ? 'full_name' then trim(p_data->>'full_name') else full_name end,
      preferred_name  = case when p_data ? 'preferred_name' then nullif(trim(p_data->>'preferred_name'), '') else preferred_name end,
      ic_no           = case when p_data ? 'ic_no' then ic else ic_no end,
      date_of_birth   = case when p_data ? 'date_of_birth' then nullif(p_data->>'date_of_birth', '')::date else date_of_birth end,
      phone_whatsapp  = case when p_data ? 'phone_whatsapp' then tel else phone_whatsapp end,
      address         = case when p_data ? 'address' then nullif(trim(p_data->>'address'), '') else address end,
      marital_status  = case when p_data ? 'marital_status' then nullif(p_data->>'marital_status', '') else marital_status end,
      spouse_working  = case when p_data ? 'spouse_working' then (p_data->>'spouse_working')::boolean else spouse_working end,
      children_count  = case when p_data ? 'children_count' then coalesce((p_data->>'children_count')::int, 0) else children_count end,
      bank_name       = case when p_data ? 'bank_name' then nullif(trim(p_data->>'bank_name'), '') else bank_name end,
      bank_account_no = case when p_data ? 'bank_account_no' then nullif(regexp_replace(coalesce(p_data->>'bank_account_no', ''), '[^0-9A-Za-z]', '', 'g'), '') else bank_account_no end,
      nationality     = case when p_data ? 'nationality' then nullif(upper(trim(p_data->>'nationality')), '') else nationality end,
      email           = case when p_data ? 'email' then nullif(lower(trim(p_data->>'email')), '') else email end,
      passport_no     = case when p_data ? 'passport_no' then nullif(upper(trim(p_data->>'passport_no')), '') else passport_no end,
      updated_at      = now()
    where id = p.id;
  exception when unique_violation then
    if sqlerrm like '%ic_no%' then raise exception 'No. kad pengenalan ini sudah digunakan oleh orang lain'; end if;
    raise exception 'Nombor WhatsApp ini sudah digunakan oleh orang lain';
  end;

  update employments set
    epf_no   = case when p_data ? 'epf_no' then nullif(trim(p_data->>'epf_no'), '') else epf_no end,
    socso_no = case when p_data ? 'socso_no' then nullif(trim(p_data->>'socso_no'), '') else socso_no end,
    tax_no   = case when p_data ? 'tax_no' then nullif(trim(p_data->>'tax_no'), '') else tax_no end
  where id = e.id;

  -- Akaun bank ditetapkan terus oleh HR: permohonan tukar bank yang menunggu tidak lagi relevan
  if p_data ? 'bank_account_no' or p_data ? 'bank_name' then
    update bank_change_requests set status = 'cancelled', decided_at = now(), decided_by = current_person_id(),
           note = 'Dikemas kini terus oleh HR'
     where person_id = p.id and status = 'pending';
  end if;

  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  values (current_person_id(), p.id, 'profile_edit', p_via);

  if p.id <> current_person_id() then
    perform notify_person(p.id, e.company_id, case when en
      then 'HR has updated your personal details: ' || array_to_string(ubah, ', ') || '. If anything is wrong, let HR know through Ask HR.'
      else 'HR telah mengemas kini maklumat peribadi anda: ' || array_to_string(ubah, ', ') || '. Jika ada yang tidak betul, maklumkan HR melalui Tanya HR.' end);
  end if;
end $$;
