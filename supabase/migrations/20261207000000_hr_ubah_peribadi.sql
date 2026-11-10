-- HR / Pentadbir mengemas kini maklumat peribadi pekerja (Profil Pekerja → Maklumat peribadi → Ubah).
-- Hanya medan yang dihantar dalam p_data diubah. Setiap perubahan direkodkan dalam data_access_log (PDPA)
-- dan pekerja dimaklumkan melalui WhatsApp (medan yang diubah sahaja, tanpa nilai).

create or replace function hr_update_person(p_employment uuid, p_data jsonb, p_via action_channel default 'web')
returns void language plpgsql security definer set search_path = public as $$
declare
  e employments; p persons; tel text; ic text; ubah text[] := '{}';
  k text; en boolean;
  label_en constant jsonb := jsonb_build_object(
    'full_name', 'full name', 'preferred_name', 'preferred name', 'ic_no', 'IC number',
    'date_of_birth', 'date of birth', 'phone_whatsapp', 'WhatsApp number', 'address', 'address',
    'marital_status', 'marital status', 'spouse_working', 'spouse employment', 'children_count', 'number of children',
    'bank_name', 'bank', 'bank_account_no', 'bank account number', 'epf_no', 'EPF number', 'socso_no', 'SOCSO number', 'tax_no', 'tax number');
  label constant jsonb := jsonb_build_object(
    'full_name', 'nama penuh', 'preferred_name', 'nama panggilan', 'ic_no', 'no. kad pengenalan',
    'date_of_birth', 'tarikh lahir', 'phone_whatsapp', 'nombor WhatsApp', 'address', 'alamat',
    'marital_status', 'status perkahwinan', 'spouse_working', 'status kerja pasangan', 'children_count', 'bilangan anak',
    'bank_name', 'bank', 'bank_account_no', 'no. akaun bank', 'epf_no', 'no. KWSP', 'socso_no', 'no. PERKESO', 'tax_no', 'no. cukai');
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
                 'marital_status','spouse_working','children_count','bank_name','bank_account_no','epf_no','socso_no','tax_no'], j.key) ord
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

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function hr_update_person(uuid, jsonb, action_channel) from public, anon;
    grant execute on function hr_update_person(uuid, jsonb, action_channel) to authenticated;
  end if;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^HR telah mengemas kini maklumat peribadi anda: (.+)\. Jika ada yang tidak betul, maklumkan HR melalui Tanya HR\.$$q$,
   $q$HR has updated your personal details: \1. If anything is wrong, let HR know through Ask HR.$q$, 122, true)
on conflict (kind, ms) do update set en = excluded.en;
