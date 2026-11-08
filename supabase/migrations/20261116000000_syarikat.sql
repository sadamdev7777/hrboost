-- =====================================================================
--  Fasa G (1): Daftar syarikat, persediaan syarikat 6 langkah, import pekerja, jemputan pukal
-- =====================================================================

alter table companies add column if not exists size_band text check (size_band in ('1–10','11–50','51–200','200+'));
alter table notifications add column if not exists send_after timestamptz;

-- ---------------------------------------------------------------------
-- 1. register_company: gunakan nombor telefon yang DISAHKAN oleh OTP (auth.users.phone),
--    bukan nombor yang dihantar oleh pelayar. Versi asal boleh memautkan rekod orang lain
--    (berdasarkan p_phone) kepada akaun pemanggil.
-- ---------------------------------------------------------------------
create or replace function register_company(p_company_name text, p_size text, p_full_name text,
                                            p_phone text, p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; cid uuid; v_code text; i int := 0; telefon text; nama text := trim(p_full_name);
begin
  if auth.uid() is null then raise exception 'Sila sahkan nombor WhatsApp dahulu'; end if;
  if coalesce((platform_setting('registration_open') #>> '{}')::boolean, true) is false then
    raise exception 'Pendaftaran syarikat baru ditutup sementara';
  end if;
  if coalesce(trim(p_company_name), '') = '' or length(trim(p_company_name)) > 120 then raise exception 'Sila isi nama syarikat'; end if;
  if coalesce(nama, '') = '' then raise exception 'Sila isi nama penuh anda'; end if;
  if p_email is not null and p_email <> '' and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mel tidak sah'; end if;
  begin
    execute 'select regexp_replace(coalesce(phone, ''''), ''\D'', '''', ''g'') from auth.users where id = $1' into telefon using auth.uid();
  exception when undefined_column then
    -- hanya stub ujian tempatan (auth.users tanpa lajur phone); Supabase sebenar sentiasa mempunyai lajur ini
    telefon := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  end;
  if coalesce(telefon, '') = '' then raise exception 'Nombor WhatsApp belum disahkan'; end if;
  -- had: satu pengguna boleh mendaftar maksimum 5 syarikat sehari (elak penyalahgunaan)
  if (select count(*) from companies c join persons p on p.id = c.created_by
       where p.auth_user_id = auth.uid() and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Had pendaftaran harian dicapai. Cuba lagi esok.';
  end if;

  select id into pid from persons where auth_user_id = auth.uid();
  if pid is null then
    select id into pid from persons where phone_whatsapp = telefon and auth_user_id is null;
    if pid is null then
      insert into persons(auth_user_id, full_name, preferred_name, phone_whatsapp, email)
      values (auth.uid(), upper(nama), split_part(initcap(nama), ' ', 1), telefon, nullif(trim(p_email), ''))
      returning id into pid;
    else
      update persons set auth_user_id = auth.uid() where id = pid;
    end if;
  end if;

  v_code := upper(left(regexp_replace(regexp_replace(p_company_name, '\m(syarikat|perniagaan|sdn|bhd|berhad|enterprise|plt|the)\M', '', 'gi'), '[^A-Za-z]', '', 'g'), 4));
  if v_code = '' then v_code := 'CO'; end if;
  while exists (select 1 from companies c where c.code = v_code || case when i = 0 then '' else i::text end) loop
    i := i + 1;
  end loop;
  v_code := v_code || case when i = 0 then '' else i::text end;
  insert into companies(code, name, created_by, size_band, wa_monthly_limit, ai_monthly_limit)
  values (v_code, upper(trim(p_company_name)), pid,
          case when replace(coalesce(p_size, ''), '-', '–') in ('1–10','11–50','51–200','200+') then replace(p_size, '-', '–') end,
          null, null) returning id into cid;
  insert into employments(person_id, company_id, employee_no, status, join_date)
  values (pid, cid, v_code || '001', 'active', (now() at time zone 'Asia/Kuala_Lumpur')::date);
  insert into user_roles(person_id, company_id, role) values (pid, cid, 'admin'), (pid, cid, 'hr'), (pid, cid, 'ceo');
  perform seed_company_defaults(cid);
  insert into company_onboarding_progress(company_id, step) values (cid, 'admin');
  perform log_platform('company.register', cid, 'company', cid, jsonb_build_object('size', p_size));
  return cid;
end $$;

-- ---------------------------------------------------------------------
-- 2. Keadaan persediaan syarikat (OnboardingSyarikat) & tanda langkah selesai
-- ---------------------------------------------------------------------
create or replace function company_onboarding_state(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when has_role(p_company, '{hr,admin}') then jsonb_build_object(
    'name', c.name, 'code', c.code, 'completed_at', c.onboarding_completed_at,
    'steps', coalesce((select jsonb_agg(step) from company_onboarding_progress where company_id = c.id), '[]'),
    'employees', (select count(*) from employments where company_id = c.id and status in ('probation','active')),
    'activated', (select count(*) from employments e join persons p on p.id = e.person_id
                   where e.company_id = c.id and e.status in ('probation','active') and p.auth_user_id is not null),
    'departments', (select count(*) from departments where company_id = c.id),
    'departments_without_head', (select count(*) from departments d where d.company_id = c.id and d.head_person_id is null
                                  and exists (select 1 from employments e where e.department_id = d.id and e.status in ('probation','active'))),
    'holidays', (select count(*) from company_holiday_options(c.id, extract(year from now())::int) where chosen),
    'invites_pending', (select count(*) from employments e join persons p on p.id = e.person_id
                         where e.company_id = c.id and e.status in ('probation','active') and p.auth_user_id is null)
  ) end
  from companies c where c.id = p_company
$$;

create or replace function complete_company_step(p_company uuid, p_step text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_step not in ('company','import','departments','roles','invite') then raise exception 'Langkah tidak dikenali'; end if;
  if p_step = 'departments' and exists (select 1 from departments d where d.company_id = p_company and d.head_person_id is null
       and exists (select 1 from employments e where e.department_id = d.id and e.status in ('probation','active'))) then
    raise exception 'Setiap jabatan mesti mempunyai ketua';
  end if;
  insert into company_onboarding_progress(company_id, step) values (p_company, p_step) on conflict do nothing;
  if (select count(*) from company_onboarding_progress where company_id = p_company) >= 6 then
    update companies set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = p_company;
  end if;
  return company_onboarding_state(p_company);
end $$;

-- Kod pendek syarikat boleh ditukar semasa persediaan sahaja
create or replace function set_company_code(p_company uuid, p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare k text := upper(trim(p_code));
begin
  if not has_role(p_company, '{admin}') then raise exception 'Hanya Pentadbir'; end if;
  if (select onboarding_completed_at from companies where id = p_company) is not null then
    raise exception 'Kod syarikat tidak boleh ditukar selepas persediaan selesai';
  end if;
  if k !~ '^[A-Z][A-Z0-9]{1,7}$' then raise exception 'Kod mesti 2–8 huruf/nombor, bermula dengan huruf'; end if;
  if exists (select 1 from companies where code = k and id <> p_company) then raise exception 'Kod % telah digunakan', k; end if;
  update employments set employee_no = k || substr(employee_no, length((select code from companies where id = p_company)) + 1)
   where company_id = p_company and employee_no like (select code from companies where id = p_company) || '%';
  update companies set code = k where id = p_company;
  return k;
end $$;

-- ---------------------------------------------------------------------
-- 3. Import pekerja pukal (ImportPekerja). Setiap baris:
--    {full_name, preferred_name, phone, ic, department, position, join_date, basic, type, is_head}
-- ---------------------------------------------------------------------
create or replace function import_employees(p_company uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; i int := 0; dept uuid; eid uuid; ok int := 0; gagal jsonb := '[]'; tel text; ic text; tarikh date;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'Data import tidak sah (maksimum 1000 baris)'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if coalesce(trim(r->>'full_name'), '') = '' then raise exception 'Tiada nama'; end if;
      tel := regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g');
      if tel <> '' then
        tel := case when tel ~ '^0' then '6' || tel when tel ~ '^1' then '60' || tel else tel end;
        if tel !~ '^601\d{8,9}$' then raise exception 'No. WhatsApp tidak sah'; end if;
      end if;
      ic := regexp_replace(coalesce(r->>'ic', ''), '\D', '', 'g');
      if ic <> '' and length(ic) <> 12 then raise exception 'No. kad pengenalan tidak sah'; end if;
      if ic <> '' then ic := substr(ic,1,6) || '-' || substr(ic,7,2) || '-' || substr(ic,9,4); end if;
      tarikh := coalesce(nullif(r->>'join_date', '')::date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
      dept := null;
      if coalesce(trim(r->>'department'), '') <> '' then
        insert into departments(company_id, name) values (p_company, initcap(trim(r->>'department')))
        on conflict (company_id, name) do update set name = excluded.name returning id into dept;
      end if;
      if exists (select 1 from employments e join persons p on p.id = e.person_id where e.company_id = p_company
                  and e.status in ('probation','active') and ((tel <> '' and p.phone_whatsapp = tel) or (ic <> '' and p.ic_no = ic))) then
        raise exception 'Sudah wujud dalam syarikat ini';
      end if;
      eid := add_employee(p_company, upper(trim(r->>'full_name')),
                          coalesce(nullif(trim(r->>'preferred_name'), ''), split_part(initcap(trim(r->>'full_name')), ' ', 1)),
                          nullif(tel, ''), nullif(ic, ''), dept, nullif(trim(r->>'position'), ''), tarikh,
                          coalesce(nullif(r->>'type', ''), 'permanent')::employment_type, 0, nullif(r->>'basic', '')::numeric);
      if coalesce((r->>'is_head')::boolean, false) and dept is not null then
        update departments set head_person_id = (select person_id from employments where id = eid) where id = dept;
        update employments set manager_person_id = (select person_id from employments where id = eid)
         where department_id = dept and id <> eid;
      end if;
      ok := ok + 1;
    exception when others then
      gagal := gagal || jsonb_build_object('row', i, 'name', r->>'full_name', 'error', sqlerrm);
    end;
  end loop;
  -- pekerja yang diimport sebelum ketua jabatannya: tetapkan pengurus
  update employments e set manager_person_id = d.head_person_id from departments d
   where e.department_id = d.id and e.company_id = p_company and e.manager_person_id is null
     and d.head_person_id is not null and e.person_id <> d.head_person_id;
  if ok > 0 then
    insert into company_onboarding_progress(company_id, step) values (p_company, 'import') on conflict do nothing;
  end if;
  perform emit_event(p_company, 'employees.imported', current_person_id(), null, jsonb_build_object('created', ok));
  return jsonb_build_object('created', ok, 'failed', gagal);
end $$;

-- Tetapkan ketua jabatan (SyarikatJabatan); pekerja jabatan itu mendapat pengurus yang sama
create or replace function set_department_head(p_department uuid, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d departments;
begin
  select * into d from departments where id = p_department;
  if d.id is null or not has_role(d.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_person is not null and not exists (select 1 from employments where person_id = p_person and company_id = d.company_id
                                           and status in ('probation','active')) then
    raise exception 'Ketua mesti pekerja syarikat ini';
  end if;
  update departments set head_person_id = p_person where id = d.id;
  update employments set manager_person_id = p_person
   where department_id = d.id and status in ('probation','active') and person_id is distinct from p_person;
end $$;

-- ---------------------------------------------------------------------
-- 4. Jemputan pukal (SyarikatJemput): sekarang atau dijadualkan
-- ---------------------------------------------------------------------
create or replace function invite_pending(p_company uuid, p_base_url text, p_send_after timestamptz default null)
returns table(employment_id uuid, name text, has_whatsapp boolean, token text)
language plpgsql security definer set search_path = public as $$
declare e record; tok text;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  for e in select em.id, coalesce(p.preferred_name, p.full_name) nm, p.phone_whatsapp, p.id pid
             from employments em join persons p on p.id = em.person_id
            where em.company_id = p_company and em.status in ('probation','active') and p.auth_user_id is null
            order by em.employee_no loop
    tok := invite_employee(e.id, p_base_url);
    if p_send_after is not null then
      update notifications set send_after = p_send_after
       where person_id = e.pid and status = 'pending' and message like '%/jemputan/%' and created_at > now() - interval '1 minute';
    end if;
    employment_id := e.id; name := e.nm; has_whatsapp := e.phone_whatsapp is not null;
    token := case when e.phone_whatsapp is null then tok end;   -- pautan untuk disalin hanya jika tiada WhatsApp
    return next;
  end loop;
  insert into company_onboarding_progress(company_id, step) values (p_company, 'invite') on conflict do nothing;
  if (select count(*) from company_onboarding_progress where company_id = p_company) >= 6 then
    update companies set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = p_company;
  end if;
end $$;

-- add_employee asal mewajibkan no. telefon unik; benarkan pekerja tanpa WhatsApp (pautan disalin)
-- (persons.phone_whatsapp boleh null). invite_employee: tanpa WhatsApp → tiada notifikasi.
create or replace function notify_next(p_limit int default 50)
returns table(id uuid, to_address text, message text, company_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare n notifications; ok boolean; m date := date_trunc('month', now())::date; a record;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  for n in
    select * from notifications x
     where x.status = 'pending' and x.channel = 'whatsapp'
       and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
       and (x.send_after is null or x.send_after <= now())
     order by x.created_at
     limit p_limit
     for update skip locked
  loop
    if n.to_address is null then
      update notifications set status = 'failed', error = 'Tiada nombor WhatsApp' where notifications.id = n.id;
      continue;
    end if;
    ok := n.company_id is null or n.bypass_limit or bump_usage(n.company_id, 'wa');
    if not ok then
      update notifications set status = 'skipped', error = 'Had WhatsApp bulanan syarikat telah habis'
       where notifications.id = n.id;
      if not coalesce((select wa_limit_notified from usage_counters u
                        where u.company_id = n.company_id and u.month = m), false) then
        update usage_counters set wa_limit_notified = true where usage_counters.company_id = n.company_id and month = m;
        for a in select r.person_id from user_roles r where r.company_id = n.company_id and r.role = 'admin' loop
          insert into notifications(company_id, person_id, channel, to_address, message, bypass_limit)
          select n.company_id, ps.id, 'whatsapp', ps.phone_whatsapp,
                 'Makluman HRBoost: had mesej WhatsApp bulan ini untuk syarikat anda telah habis. '
                 || 'Notifikasi seterusnya tidak dihantar sehingga bulan hadapan. Hubungi HRBoost untuk menambah had.',
                 true
            from persons ps where ps.id = a.person_id and ps.is_active;
        end loop;
      end if;
      continue;
    end if;
    update notifications set claimed_at = now(), attempts = attempts + 1 where notifications.id = n.id;
    id := n.id; to_address := n.to_address; message := n.message; company_id := n.company_id;
    return next;
  end loop;
end $$;
-- Kebenaran fungsi
do $$
declare f text;
begin
  foreach f in array array[
    'company_onboarding_state(uuid)', 'complete_company_step(uuid, text)', 'set_company_code(uuid, text)',
    'import_employees(uuid, jsonb)', 'set_department_head(uuid, uuid)', 'invite_pending(uuid, text, timestamptz)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;
