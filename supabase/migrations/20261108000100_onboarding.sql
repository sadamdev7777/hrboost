-- =====================================================================
--  Fasa B: jemputan & orientasi pekerja (skrin Daftar, Onboarding*)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Paparan jemputan sebelum log masuk (skrin Daftar).
--    Token rahsia (18 bait rawak, tamat 7 hari) dihantar dalam pautan WhatsApp.
--    Hanya maklumat yang dipaparkan pada skrin dipulangkan. Nombor telefon
--    diperlukan untuk menghantar OTP ke nombor yang dijemput sahaja.
-- ---------------------------------------------------------------------
create or replace function invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare inv employee_invites; e employments; p persons; c companies;
begin
  select * into inv from employee_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if inv.id is null or inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Pautan tidak sah atau telah tamat. Minta HR hantar semula.');
  end if;
  if inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'accepted', true,
      'error', 'Akaun ini telah diaktifkan. Sila log masuk dengan nombor telefon anda.');
  end if;
  select * into e from employments where id = inv.employment_id;
  select * into p from persons where id = e.person_id;
  select * into c from companies where id = e.company_id;
  return jsonb_build_object(
    'ok', true,
    'name', coalesce(p.preferred_name, split_part(p.full_name, ' ', 1)),
    'phone', p.phone_whatsapp,
    'company_code', c.code,
    'company_name', c.name,
    'position', (select title from positions where id = e.position_id),
    'department', (select name from departments where id = e.department_id),
    'head', (select coalesce(h.preferred_name, h.full_name) from departments d join persons h on h.id = d.head_person_id
              where d.id = e.department_id),
    'join_date', e.join_date,
    'status', e.status,
    'probation_months', case when e.probation_end_date is not null
                             then (extract(year from age(e.probation_end_date, e.join_date)) * 12
                                   + extract(month from age(e.probation_end_date, e.join_date)))::int end,
    'expires_at', inv.expires_at,
    'days_left', greatest(0, ceil(extract(epoch from (inv.expires_at - now())) / 86400))::int,
    'attempts_left', greatest(0, 5 - inv.attempts)
  );
end $$;

revoke execute on function invite_preview(text) from public;
grant execute on function invite_preview(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Simpan satu langkah orientasi. Pekerja tidak mengemas kini jadual
--    secara terus: fungsi ini menyemak pemilikan dan hanya menulis medan
--    yang dibenarkan bagi langkah itu.
--      name      {full_name, preferred_name}
--      selfie    {photo_path}
--      bank      {bank_name, bank_account_no, contact_name, contact_relationship, contact_phone}
--      ic        {front_path, back_path}
--      personal  {address, marital_status, spouse_working, children_count, epf_no, tax_no, need_help}
--      handbook  {}            install {}
-- ---------------------------------------------------------------------
create or replace function save_onboarding_step(p_employment uuid, p_step text, p_data jsonb default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e employments; me uuid := current_person_id(); d jsonb := coalesce(p_data, '{}'); v text;
begin
  select * into e from employments where id = p_employment;
  if me is null or e.id is null or e.person_id <> me then raise exception 'Bukan rekod anda'; end if;

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

revoke execute on function save_onboarding_step(uuid, text, jsonb) from public, anon;
grant execute on function save_onboarding_step(uuid, text, jsonb) to authenticated, service_role;
revoke execute on function complete_onboarding_step(uuid, text) from anon;

-- ---------------------------------------------------------------------
-- 3. Pengetatan: polisi RLS `update_self` membenarkan pekerja mengemas kini
--    baris sendiri dalam `persons`, termasuk telefon, IC, status aktif dan
--    pautan auth. Hadkan kemas kini terus kepada lajur profil sahaja; perubahan
--    identiti dibuat oleh HR melalui RPC.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke update on persons from authenticated;
    grant update (preferred_name, date_of_birth, gender, marital_status, email, address,
                  bank_name, bank_account_no, photo_path, language, hide_birthday,
                  spouse_working, children_count, updated_at)
      on persons to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Storan peribadi untuk swafoto, kad pengenalan dan sijil (CLAUDE.md §6).
--    Laluan fail: <person_id>/<nama-fail>. Pemilik boleh muat naik & baca
--    fail sendiri; HR/Pentadbir syarikat tempat orang itu bekerja boleh membaca.
--    Dilangkau jika skema `storage` tiada (ujian Postgres biasa).
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Skema storage tiada: bucket dilangkau';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('peribadi', 'peribadi', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy peribadi_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'peribadi' and (storage.foldername(name))[1] = public.current_person_id()::text)
  $p$;
  execute $p$
    create policy peribadi_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'peribadi' and (storage.foldername(name))[1] = public.current_person_id()::text)
  $p$;
  execute $p$
    create policy peribadi_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'peribadi' and (storage.foldername(name))[1] = public.current_person_id()::text)
  $p$;
  execute $p$
    create policy peribadi_hr_select on storage.objects for select to authenticated
      using (bucket_id = 'peribadi' and exists (
        select 1 from public.employments x
         where x.person_id::text = (storage.foldername(name))[1]
           and public.has_role(x.company_id, '{hr,admin}')))
  $p$;
  -- Pelulus permohonan cuti boleh membaca sijil yang dilampirkan pada permohonan itu (cth. MC).
  execute $p$
    create policy peribadi_approver_select on storage.objects for select to authenticated
      using (bucket_id = 'peribadi' and exists (
        select 1 from public.leave_requests lr
         where lr.attachment_path = storage.objects.name
           and public.is_approver_of(lr.approval_request_id)))
  $p$;
end $$;
