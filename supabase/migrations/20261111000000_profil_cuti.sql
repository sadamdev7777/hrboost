-- =====================================================================
--  Fasa D2: skrin Cuti (kalendar pasukan), Profil, Ubah Profil, Hari Jadi
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kalendar cuti pasukan: cuti (menunggu & lulus) rakan sejabatan dan diri sendiri.
--    Hanya nama panggilan dan tarikh — tiada jenis cuti, sebab atau lampiran rakan.
-- ---------------------------------------------------------------------
create or replace function team_leave_calendar(p_company uuid, p_from date, p_to date)
returns table(person_id uuid, name text, start_date date, end_date date, half_day leave_half,
              status request_status, is_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select e.id, e.department_id from employments e
     where e.company_id = p_company and e.person_id = current_person_id()
       and e.status in ('probation','active')
     limit 1
  )
  select p.id, coalesce(p.preferred_name, p.full_name), lr.start_date, lr.end_date, lr.half_day,
         lr.status, p.id = current_person_id()
    from me
    join employments e on e.company_id = p_company
                      and (e.id = me.id or (me.department_id is not null and e.department_id = me.department_id))
    join persons p on p.id = e.person_id and p.is_active
    join leave_requests lr on lr.employment_id = e.id
   where lr.status in ('pending','approved')
     and lr.start_date <= p_to and lr.end_date >= p_from
   order by lr.start_date, 2
$$;

-- ---------------------------------------------------------------------
-- 2. Cuti umum yang terpakai bagi syarikat (logik sama dengan is_working_day).
-- ---------------------------------------------------------------------
create or replace function company_holidays(p_company uuid, p_from date, p_to date)
returns table(holiday_date date, name text)
language sql stable security definer set search_path = public as $$
  select h.holiday_date, h.name
    from companies c join public_holidays h
      on h.holiday_date between p_from and p_to
     and (h.company_id is null or h.company_id = c.id)
     and (h.state is null or h.state = c.state)
     and ( h.is_mandatory or h.is_adhoc
           or not exists (select 1 from company_holiday_choices x
                           where x.company_id = c.id and x.year = extract(year from h.holiday_date)::int)
           or exists (select 1 from company_holiday_choices x
                       where x.company_id = c.id and x.holiday_id = h.id) )
   where c.id = p_company and is_company_member(p_company)
   order by h.holiday_date
$$;

-- ---------------------------------------------------------------------
-- 3. Ubah profil sendiri (skrin ProfilUbah). Boleh dipanggil oleh aplikasi atau agent.
-- ---------------------------------------------------------------------
create or replace function update_my_profile(p_data jsonb, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := current_person_id(); d jsonb := coalesce(p_data, '{}');
begin
  if me is null then raise exception 'Sila log masuk'; end if;
  if d ? 'preferred_name' then
    if coalesce(trim(d->>'preferred_name'), '') = '' then raise exception 'Sila isi nama panggilan'; end if;
    if length(trim(d->>'preferred_name')) > 40 then raise exception 'Nama panggilan terlalu panjang'; end if;
    update persons set preferred_name = trim(d->>'preferred_name') where id = me;
  end if;
  if d ? 'address' then
    update persons set address = nullif(trim(d->>'address'), '') where id = me;
  end if;
  if d ? 'photo_path' then
    if coalesce(d->>'photo_path', '') = '' or split_part(d->>'photo_path', '/', 1) <> me::text then
      raise exception 'Gambar tidak sah';
    end if;
    update persons set photo_path = d->>'photo_path' where id = me;
  end if;
  if d ? 'children_count' then
    if (d->>'children_count') !~ '^\d{1,2}$' then raise exception 'Bilangan anak tidak sah'; end if;
    update persons set children_count = (d->>'children_count')::int where id = me;
  end if;
  if d ? 'hide_birthday' then
    update persons set hide_birthday = coalesce((d->>'hide_birthday')::boolean, false) where id = me;
  end if;
  if d ? 'contact_name' then
    if coalesce(trim(d->>'contact_name'), '') = '' or coalesce(trim(d->>'contact_phone'), '') = '' then
      raise exception 'Sila isi nama dan nombor telefon waris';
    end if;
    delete from emergency_contacts where person_id = me;
    insert into emergency_contacts(person_id, name, relationship, phone)
    values (me, trim(d->>'contact_name'), nullif(trim(d->>'contact_relationship'), ''), trim(d->>'contact_phone'));
  end if;
  update persons set updated_at = now() where id = me;
end $$;

-- ---------------------------------------------------------------------
-- 4. Tukar akaun bank: perlu disahkan HR (reka bentuk Profil / ProfilUbah).
-- ---------------------------------------------------------------------
create table if not exists bank_change_requests (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references persons(id) on delete cascade,
  bank_name        text not null,
  bank_account_no  text not null,
  status           text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  via              action_channel not null default 'web',
  requested_at     timestamptz not null default now(),
  decided_by       uuid references persons(id),
  decided_at       timestamptz,
  note             text
);
create unique index if not exists bank_change_one_pending on bank_change_requests(person_id) where status = 'pending';
alter table bank_change_requests enable row level security;

drop policy if exists read_bank_change on bank_change_requests;
create policy read_bank_change on bank_change_requests for select using (
  person_id = current_person_id()
  or exists (select 1 from employments e where e.person_id = bank_change_requests.person_id
              and e.status in ('probation','active') and has_role(e.company_id, '{hr,admin}')));

create or replace function request_bank_change(p_bank_name text, p_account_no text,
                                               p_via action_channel default 'web')
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := current_person_id(); acc text := regexp_replace(coalesce(p_account_no, ''), '[\s-]', '', 'g');
        rid uuid; e record;
begin
  if me is null then raise exception 'Sila log masuk'; end if;
  if coalesce(trim(p_bank_name), '') = '' then raise exception 'Sila pilih bank'; end if;
  if acc !~ '^\d{6,20}$' then raise exception 'Nombor akaun tidak sah'; end if;
  update bank_change_requests set status = 'cancelled', decided_at = now()
   where person_id = me and status = 'pending';
  insert into bank_change_requests(person_id, bank_name, bank_account_no, via)
  values (me, trim(p_bank_name), acc, p_via) returning id into rid;
  for e in select id, company_id from employments where person_id = me and status in ('probation','active') loop
    perform emit_event(e.company_id, 'profile.bank_change_requested', me, e.id,
                       jsonb_build_object('request_id', rid, 'bank_name', trim(p_bank_name)));
  end loop;
  return rid;
end $$;

create or replace function decide_bank_change(p_request uuid, p_approve boolean, p_note text default null,
                                              p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare r bank_change_requests; me uuid := current_person_id();
begin
  select * into r from bank_change_requests where id = p_request for update;
  if r.id is null or r.status <> 'pending' then raise exception 'Permohonan tidak dijumpai atau telah diputuskan'; end if;
  if not exists (select 1 from employments e where e.person_id = r.person_id
                  and e.status in ('probation','active') and has_role(e.company_id, '{hr,admin}')) then
    raise exception 'Hanya HR syarikat pekerja ini boleh mengesahkan';
  end if;
  if r.person_id = me then raise exception 'Anda tidak boleh mengesahkan akaun bank sendiri'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  update bank_change_requests set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = me, decided_at = now(), note = nullif(trim(p_note), '')
   where id = r.id;
  if p_approve then
    update persons set bank_name = r.bank_name, bank_account_no = r.bank_account_no, updated_at = now()
     where id = r.person_id;
  end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  values (me, r.person_id, 'bank', p_via);
  perform notify_person(r.person_id, (select company_id from employments where person_id = r.person_id
                                       and status in ('probation','active') limit 1),
          case when p_approve then 'Pertukaran akaun bank anda telah disahkan oleh HR.'
               else 'Pertukaran akaun bank anda ditolak oleh HR. Sebab: ' || trim(p_note) end);
end $$;

-- Akaun bank kini hanya boleh ditukar melalui request_bank_change (disahkan HR).
-- Langkah orientasi (save_onboarding_step) masih menyimpan akaun pertama secara terus.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke update on persons from authenticated;
    grant update (preferred_name, date_of_birth, gender, marital_status, email, address,
                  photo_path, language, hide_birthday, spouse_working, children_count, updated_at)
      on persons to authenticated;
  end if;
end $$;

-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'team_leave_calendar(uuid, date, date)', 'company_holidays(uuid, date, date)',
    'update_my_profile(jsonb, action_channel)', 'request_bank_change(text, text, action_channel)',
    'decide_bank_change(uuid, boolean, text, action_channel)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on bank_change_requests to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Butang "Ucap selamat di WhatsApp" (HariJadi): nombor rakan sesyarikat hanya
--    dipulangkan pada hari jadinya (waktu Malaysia) dan jika tidak disembunyikan.
-- ---------------------------------------------------------------------
create or replace function birthday_whatsapp(p_company uuid, p_person uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.phone_whatsapp
    from team_birthdays(p_company, (now() at time zone 'Asia/Kuala_Lumpur')::date,
                        (now() at time zone 'Asia/Kuala_Lumpur')::date) b
    join persons p on p.id = b.person_id
   where b.person_id = p_person and p_person <> current_person_id()
$$;
revoke execute on function birthday_whatsapp(uuid, uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function birthday_whatsapp(uuid, uuid) from anon;
    grant execute on function birthday_whatsapp(uuid, uuid) to authenticated, service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Tutup jalan pintas: save_onboarding_step tidak lagi boleh menukar nama penuh
--    atau akaun bank selepas langkah itu selesai (ganti definisi dari migrasi orientasi).
-- ---------------------------------------------------------------------
create or replace function save_onboarding_step(p_employment uuid, p_step text, p_data jsonb default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e employments; me uuid := current_person_id(); d jsonb := coalesce(p_data, '{}'); v text;
begin
  select * into e from employments where id = p_employment;
  if me is null or e.id is null or e.person_id <> me then raise exception 'Bukan rekod anda'; end if;
  -- Selepas orientasi, nama penuh hanya diubah oleh HR dan akaun bank melalui request_bank_change.
  if p_step in ('name','bank') and exists (select 1 from onboarding_progress op
                                            where op.employment_id = e.id and op.step = p_step) then
    raise exception 'Langkah ini telah selesai. Sila buat perubahan melalui Profil';
  end if;

  if p_step = 'name' then
    if coalesce(trim(d->>'full_name'), '') = '' then raise exception 'Sila isi nama penuh'; end if;
    if coalesce(trim(d->>'preferred_name'), '') = '' then raise exception 'Sila isi nama panggilan'; end if;
    update persons set full_name = upper(trim(d->>'full_name')),
                       preferred_name = trim(d->>'preferred_name'), updated_at = now()
     where id = me;

  elsif p_step = 'selfie' then
    v := d->>'photo_path';
    if v is null or split_part(v, '/', 1) <> me::text then raise exception 'Gambar tidak sah'; end if;
    update persons set photo_path = v, updated_at = now() where id = me;

  elsif p_step = 'bank' then
    if coalesce(trim(d->>'bank_name'), '') = '' or coalesce(trim(d->>'bank_account_no'), '') = '' then
      raise exception 'Sila isi nama bank dan nombor akaun';
    end if;
    if coalesce(trim(d->>'contact_name'), '') = '' or coalesce(trim(d->>'contact_phone'), '') = '' then
      raise exception 'Sila isi nama dan nombor telefon waris';
    end if;
    update persons set bank_name = trim(d->>'bank_name'),
                       bank_account_no = regexp_replace(d->>'bank_account_no', '\s', '', 'g'), updated_at = now()
     where id = me;
    delete from emergency_contacts where person_id = me;
    insert into emergency_contacts(person_id, name, relationship, phone)
    values (me, trim(d->>'contact_name'), nullif(trim(d->>'contact_relationship'), ''), trim(d->>'contact_phone'));

  elsif p_step = 'ic' then
    if d->>'front_path' is null or split_part(d->>'front_path', '/', 1) <> me::text
       or d->>'back_path' is null or split_part(d->>'back_path', '/', 1) <> me::text then
      raise exception 'Sila ambil gambar hadapan dan belakang kad pengenalan';
    end if;
    delete from employee_documents where employment_id = e.id and doc_type in ('ic_front', 'ic_back');
    insert into employee_documents(employment_id, doc_type, title, storage_path, uploaded_by) values
      (e.id, 'ic_front', 'Kad pengenalan (hadapan)', d->>'front_path', me),
      (e.id, 'ic_back',  'Kad pengenalan (belakang)', d->>'back_path', me);

  elsif p_step = 'personal' then
    if coalesce(d->>'marital_status', '') not in ('bujang', 'berkahwin', 'duda_janda') then
      raise exception 'Sila pilih status perkahwinan';
    end if;
    update persons set address = nullif(trim(d->>'address'), ''),
                       marital_status = d->>'marital_status',
                       spouse_working = case when d->>'marital_status' = 'berkahwin'
                                             then coalesce((d->>'spouse_working')::boolean, true) end,
                       children_count = greatest(0, coalesce((d->>'children_count')::int, 0)),
                       updated_at = now()
     where id = me;
    update employments set epf_no = nullif(trim(d->>'epf_no'), ''), tax_no = nullif(trim(d->>'tax_no'), '')
     where id = e.id;
    if coalesce((d->>'need_help')::boolean, false) then
      perform emit_event(e.company_id, 'onboarding.statutory_help', me, e.id, '{}');
    end if;

  elsif p_step not in ('handbook', 'install') then
    raise exception 'Langkah tidak dikenali';
  end if;

  return complete_onboarding_step(e.id, p_step);
end $$;
