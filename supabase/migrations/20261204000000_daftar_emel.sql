-- =====================================================================
--  Pendaftaran & pengaktifan akaun dengan e-mel (tanpa OTP telefon).
--  - Syarikat baharu: daftar dengan e-mel + kata laluan → pautan pengesahan e-mel →
--    register_company_email() mencipta syarikat (nombor WhatsApp pilihan, untuk notifikasi).
--  - Jemputan pekerja: pautan jemputan (WhatsApp) → sahkan 4 digit akhir kad pengenalan
--    (invite_check_ic) → daftar e-mel + kata laluan → pautan pengesahan → accept_invite_email().
--  Fungsi lama (register_company, accept_invite) dikekalkan untuk keserasian.
-- =====================================================================

alter table employee_invites add column if not exists ic_verified_at timestamptz;

-- E-mel akaun log masuk semasa (hanya jika telah disahkan).
create or replace function current_verified_email() returns text
language plpgsql stable security definer set search_path = public as $$
declare em text; ok boolean;
begin
  if auth.uid() is null then return null; end if;
  begin
    execute 'select lower(email), email_confirmed_at is not null from auth.users where id = $1' into em, ok using auth.uid();
  exception when undefined_column then
    -- hanya stub ujian tempatan (auth.users tanpa lajur e-mel)
    return nullif(current_setting('test.email', true), '');
  end;
  return case when ok then em end;
end $$;
revoke all on function current_verified_email() from public, anon;
grant execute on function current_verified_email() to authenticated;

create or replace function register_company_email(p_company_name text, p_size text, p_full_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid; cid uuid; v_code text; i int := 0;
  nama text := trim(p_full_name);
  emel text := current_verified_email();
  telefon text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'Sila log masuk dahulu'; end if;
  if emel is null then raise exception 'Sila sahkan e-mel anda dahulu melalui pautan yang dihantar'; end if;
  if coalesce((platform_setting('registration_open') #>> '{}')::boolean, true) is false then
    raise exception 'Pendaftaran syarikat baru ditutup sementara';
  end if;
  if coalesce(trim(p_company_name), '') = '' or length(trim(p_company_name)) > 120 then raise exception 'Sila isi nama syarikat'; end if;
  if coalesce(nama, '') = '' then raise exception 'Sila isi nama penuh anda'; end if;
  if telefon is not null then
    if telefon like '0%' then telefon := '6' || telefon; end if;
    if telefon !~ '^601\d{8,9}$' then raise exception 'Nombor WhatsApp tidak sah'; end if;
  end if;

  select id into pid from persons where auth_user_id = auth.uid();
  -- Pautan pengesahan boleh dibuka lebih sekali: jangan cipta syarikat yang sama dua kali
  if pid is not null then
    select c.id into cid from companies c
     where c.created_by = pid and c.name = upper(trim(p_company_name)) and c.created_at > now() - interval '1 day'
     limit 1;
    if cid is not null then return cid; end if;
  end if;
  if pid is not null and (select count(*) from companies c where c.created_by = pid and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Had pendaftaran harian dicapai. Cuba lagi esok.';
  end if;

  if pid is null then
    -- Rekod sedia ada (contoh diimport oleh HR) dengan e-mel atau telefon yang sama dan belum mempunyai akaun
    select id into pid from persons where auth_user_id is null
       and (lower(email) = emel or (telefon is not null and phone_whatsapp = telefon)) limit 1;
    if pid is null then
      insert into persons(auth_user_id, full_name, preferred_name, phone_whatsapp, email)
      values (auth.uid(), upper(nama), split_part(initcap(nama), ' ', 1), telefon, emel)
      returning id into pid;
    else
      update persons set auth_user_id = auth.uid(), email = coalesce(email, emel),
             phone_whatsapp = coalesce(phone_whatsapp, telefon) where id = pid;
    end if;
  else
    update persons set email = coalesce(email, emel), phone_whatsapp = coalesce(phone_whatsapp, telefon) where id = pid;
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
  perform log_platform('company.register', cid, 'company', cid, jsonb_build_object('size', p_size, 'via', 'email'));
  return cid;
end $$;
revoke all on function register_company_email(text, text, text, text) from public, anon;
grant execute on function register_company_email(text, text, text, text) to authenticated;

-- Langkah 1 jemputan: sahkan 4 digit akhir kad pengenalan (boleh dipanggil sebelum log masuk; 5 cubaan).
create or replace function invite_check_ic(p_token text, p_ic_last4 text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare inv employee_invites; p persons;
begin
  select * into inv from employee_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Pautan tidak sah atau telah tamat. Minta HR hantar semula.');
  end if;
  if inv.attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Terlalu banyak cubaan. Minta HR hantar semula.');
  end if;
  select pe.* into p from employments e join persons pe on pe.id = e.person_id where e.id = inv.employment_id;
  if right(regexp_replace(coalesce(p.ic_no, ''), '\D', '', 'g'), 4) <> coalesce(p_ic_last4, '') then
    update employee_invites set attempts = attempts + 1 where id = inv.id;
    return jsonb_build_object('ok', false, 'error', '4 digit IC tidak sepadan', 'attempts_left', 4 - inv.attempts);
  end if;
  update employee_invites set ic_verified_at = now() where id = inv.id;
  return jsonb_build_object('ok', true, 'email', p.email);
end $$;
revoke all on function invite_check_ic(text, text) from public;
grant execute on function invite_check_ic(text, text) to anon, authenticated;

-- Langkah 2 jemputan: selepas e-mel disahkan, ikat akaun log masuk kepada pekerja.
create or replace function accept_invite_email(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare inv employee_invites; e employments; p persons; emel text := current_verified_email();
begin
  if auth.uid() is null then raise exception 'Sila log masuk dahulu'; end if;
  if emel is null then raise exception 'Sila sahkan e-mel anda dahulu melalui pautan yang dihantar'; end if;
  select * into inv from employee_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  select * into e from employments where id = inv.employment_id;
  select * into p from persons where id = e.person_id;
  -- Pautan pengesahan dibuka semula selepas berjaya: kekal berjaya
  if inv.accepted_at is not null and p.auth_user_id = auth.uid() then
    return jsonb_build_object('ok', true, 'employment_id', e.id);
  end if;
  if inv.id is null or inv.accepted_at is not null or inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Pautan tidak sah atau telah tamat. Minta HR hantar semula.');
  end if;
  if inv.ic_verified_at is null or inv.ic_verified_at < now() - interval '2 days' then
    return jsonb_build_object('ok', false, 'error', 'Sila sahkan 4 digit akhir kad pengenalan anda sekali lagi.');
  end if;
  if p.auth_user_id is not null and p.auth_user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Akaun ini sudah diaktifkan oleh pengguna lain. Hubungi HR.');
  end if;
  if exists (select 1 from persons x where x.auth_user_id = auth.uid() and x.id <> p.id) then
    return jsonb_build_object('ok', false, 'error', 'E-mel ini sudah digunakan oleh akaun lain. Gunakan e-mel lain atau hubungi HR.');
  end if;
  update persons set auth_user_id = auth.uid(), email = coalesce(email, emel) where id = p.id;
  update employee_invites set accepted_at = now() where id = inv.id;
  insert into onboarding_progress(employment_id, step) values (e.id, 'activate') on conflict do nothing;
  perform emit_event(e.company_id, 'invite.accepted', p.id, e.id, '{}');
  return jsonb_build_object('ok', true, 'employment_id', e.id);
end $$;
revoke all on function accept_invite_email(text) from public, anon;
grant execute on function accept_invite_email(text) to authenticated;
