-- =====================================================================
--  register_company_email: nombor WhatsApp yang sudah digunakan oleh orang lain tidak lagi menggagalkan
--  pendaftaran (ralat persons_phone_whatsapp_key). Syarikat dicipta tanpa nombor; pengguna boleh
--  mengisinya kemudian. Rekod diimport HR (tanpa akaun) dengan e-mel yang sama masih dipadankan seperti dahulu.
-- =====================================================================
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
  -- Nombor WhatsApp sudah digunakan oleh orang lain (cth. akaun lain milik pemohon yang sama): teruskan
  -- pendaftaran tanpa nombor; boleh diisi kemudian di Profil
  -- (Rekod tanpa akaun yang diimport HR dengan nombor ini masih dipadankan di bawah jika pengguna belum ada rekod.)
  if telefon is not null and exists (select 1 from persons x where x.phone_whatsapp = telefon
       and x.id is distinct from pid and (x.auth_user_id is not null or pid is not null)) then
    telefon := null;
  end if;
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
      values (auth.uid(), upper(nama), nama_panggilan_lalai(nama), telefon, emel)
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
  -- Pengasas bukan pekerja baharu: tiada senarai semak orientasi
  delete from onboarding_checklist_items where employment_id = (select id from employments where person_id = pid and company_id = cid);
  insert into company_onboarding_progress(company_id, step) values (cid, 'admin');
  perform log_platform('company.register', cid, 'company', cid, jsonb_build_object('size', p_size, 'via', 'email'));
  return cid;
end $$;
