-- Profil Saya: pekerja mengemas kini profil sendiri.
--   Ubah terus      : gambar profil, nama panggilan, alamat, e-mel peribadi, waris kecemasan, keluarga, sorok hari jadi
--   Perlu HR sahkan : akaun bank, status perkahwinan & bilangan anak (PCB), no. KWSP / PERKESO / cukai, nama penuh & no. KP (dengan gambar KP)
--                     → melalui enjin kelulusan yang sama (request_type 'profile_change', peringkat HR); diluluskan = dikemas kini automatik
--   HR sahaja       : jawatan, jabatan, gaji, tarikh mula, jenis pekerjaan
-- Gambar profil berasingan daripada swafoto pengesahan orientasi: bucket peribadi `avatar`, boleh dilihat oleh rakan sekerja syarikat yang sama.

alter table persons add column if not exists avatar_path text;

create or replace function same_company_person(p_person text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_person = current_person_id()::text or exists (
    select 1 from employments a join employments b on b.company_id = a.company_id
     where a.person_id::text = p_person and b.person_id = current_person_id()
       and a.status in ('probation','active') and b.status in ('probation','active')
       and is_company_member(b.company_id))
$$;

-- 1. Bucket gambar profil (peribadi; URL bertandatangan)
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatar', 'avatar', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  drop policy if exists avatar_own_write on storage.objects;
  drop policy if exists avatar_own_update on storage.objects;
  drop policy if exists avatar_own_delete on storage.objects;
  drop policy if exists avatar_colleague_read on storage.objects;
  execute $p$ create policy avatar_own_write on storage.objects for insert to authenticated
    with check (bucket_id = 'avatar' and (storage.foldername(storage.objects.name))[1] = public.current_person_id()::text) $p$;
  execute $p$ create policy avatar_own_update on storage.objects for update to authenticated
    using (bucket_id = 'avatar' and (storage.foldername(storage.objects.name))[1] = public.current_person_id()::text) $p$;
  execute $p$ create policy avatar_own_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatar' and (storage.foldername(storage.objects.name))[1] = public.current_person_id()::text) $p$;
  -- Sendiri, atau rakan sekerja dalam syarikat yang sama
  execute $p$ create policy avatar_colleague_read on storage.objects for select to authenticated
    using (bucket_id = 'avatar' and public.same_company_person((storage.foldername(storage.objects.name))[1])) $p$;
end $$;



-- Gambar profil rakan sekerja (laluan sahaja; fail dibaca melalui URL bertandatangan)
create or replace function company_avatars(p_company uuid) returns table(person_id uuid, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.avatar_path from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active') and p.avatar_path is not null
     and is_company_member(p_company)
$$;

-- 2. Aliran kelulusan lalai: peringkat HR
create or replace function ensure_workflow(p_company uuid, p_type request_type) returns approval_workflows
language plpgsql security definer set search_path = public as $$
declare wf approval_workflows;
begin
  select * into wf from approval_workflows where company_id = p_company and request_type = p_type and active;
  if wf.id is null then
    insert into approval_workflows(company_id, request_type, name, sla)
    values (p_company, p_type, case p_type when 'overtime' then 'Kerja Lebih Masa' when 'salary_advance' then 'Pendahuluan Gaji' when 'profile_change' then 'Kemas Kini Profil' else 'Kelulusan ' || p_type end, 'same_day')
    returning * into wf;
    if p_type = 'salary_advance' then
      insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values (wf.id, 1, 'CEO', 'role', 'ceo');
    elsif p_type = 'profile_change' then
      insert into approval_workflow_steps(workflow_id, step_order, name, approver, approver_role) values (wf.id, 1, 'HR', 'role', 'hr');
    else
      insert into approval_workflow_steps(workflow_id, step_order, name, approver) values (wf.id, 1, 'Ketua Jabatan', 'dept_head');
    end if;
  end if;
  return wf;
end $$;


select ensure_workflow(id, 'profile_change') from companies;

-- 3. Permohonan kemas kini profil
create table if not exists profile_change_requests (
  id                  uuid primary key default gen_random_uuid(),
  employment_id       uuid not null references employments(id) on delete cascade,
  person_id           uuid not null references persons(id) on delete cascade,
  changes             jsonb not null,               -- [{field, label, old, new}]
  attachment_path     text,
  status              text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','returned')),
  approval_request_id uuid,
  created_at          timestamptz not null default now(),
  decided_at          timestamptz
);
alter table profile_change_requests enable row level security;
drop policy if exists pcr_read on profile_change_requests;
create policy pcr_read on profile_change_requests for select to authenticated
  using (person_id = current_person_id() or has_role(employment_company(employment_id), '{hr,admin}'));
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select on profile_change_requests to authenticated; end if;
end $$;

create or replace function submit_profile_change(p_employment uuid, p_changes jsonb, p_attachment text default null,
                                                 p_via action_channel default 'web', p_on_behalf uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; p persons; senarai jsonb := '[]'; k text; v text; lama text; lbl text; ic text; r profile_change_requests; rid uuid;
  label constant jsonb := jsonb_build_object(
    'full_name', 'nama penuh', 'ic_no', 'no. kad pengenalan', 'bank_name', 'bank', 'bank_account_no', 'no. akaun bank',
    'marital_status', 'status perkahwinan', 'spouse_working', 'pasangan bekerja', 'children_count', 'bilangan anak',
    'epf_no', 'no. KWSP', 'socso_no', 'no. PERKESO', 'tax_no', 'no. cukai');
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  select * into p from persons where id = e.person_id;
  if exists (select 1 from profile_change_requests where employment_id = e.id and status = 'pending') then
    raise exception 'Anda masih mempunyai permohonan kemas kini profil yang menunggu HR';
  end if;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_changes, '{}')) loop
    if not label ? k then raise exception 'Medan tidak dikenali: %', k; end if;
    v := nullif(trim(coalesce(v, '')), '');
    if k = 'ic_no' then
      v := regexp_replace(coalesce(v, ''), '\D', '', 'g');
      if v !~ '^\d{12}$' then raise exception 'No. kad pengenalan mesti 12 digit'; end if;
    elsif k = 'bank_account_no' then
      v := regexp_replace(coalesce(v, ''), '[\s-]', '', 'g');
      if v !~ '^\d{6,20}$' then raise exception 'Nombor akaun tidak sah'; end if;
    elsif k = 'children_count' and coalesce(v, '0') !~ '^\d{1,2}$' then raise exception 'Bilangan anak tidak sah';
    elsif k = 'marital_status' and coalesce(v, '') not in ('bujang', 'berkahwin', 'duda_janda') then raise exception 'Status perkahwinan tidak sah';
    elsif k = 'full_name' and v is null then raise exception 'Sila isi nama penuh';
    end if;
    lama := case k when 'epf_no' then e.epf_no when 'socso_no' then e.socso_no when 'tax_no' then e.tax_no else to_jsonb(p) ->> k end;
    if lama is distinct from v then
      senarai := senarai || jsonb_build_object('field', k, 'label', label ->> k, 'old', lama, 'new', v);
    end if;
  end loop;
  if jsonb_array_length(senarai) = 0 then raise exception 'Tiada perubahan'; end if;
  if (p_changes ? 'full_name' or p_changes ? 'ic_no') and coalesce(p_attachment, '') = '' then
    raise exception 'Sila lampirkan gambar kad pengenalan untuk menukar nama penuh atau no. kad pengenalan';
  end if;
  if p_attachment is not null and split_part(p_attachment, '/', 1) <> actor::text then raise exception 'Lampiran tidak sah'; end if;
  perform ensure_workflow(e.company_id, 'profile_change');
  if not exists (select 1 from user_roles where company_id = e.company_id and role in ('hr', 'admin')) then
    raise exception 'HR syarikat belum ditetapkan. Hubungi pentadbir syarikat.';
  end if;
  insert into profile_change_requests(employment_id, person_id, changes, attachment_path)
  values (e.id, actor, senarai, p_attachment) returning * into r;
  select string_agg(x->>'label', ', ') into lbl from jsonb_array_elements(senarai) x;
  rid := approval_create('profile_change', r.id, e.id, 'Kemas kini profil: ' || lbl,
                         jsonb_build_object('changes', senarai, 'attachment', p_attachment), false, p_via);
  update profile_change_requests set approval_request_id = rid where id = r.id;
  return rid;
end $$;

-- Hasil kelulusan: perubahan dikenakan secara automatik apabila HR meluluskan
create or replace function approval_profile_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare r profile_change_requests; x jsonb; v text;
begin
  if new.request_type <> 'profile_change' or new.status = old.status then return new; end if;
  update profile_change_requests set status = new.status::text, decided_at = case when new.status <> 'pending' then now() end
   where id = new.reference_id returning * into r;
  if new.status <> 'approved' or r.id is null then return new; end if;
  for x in select * from jsonb_array_elements(r.changes) loop
    v := x->>'new';
    case x->>'field'
      when 'full_name' then update persons set full_name = v where id = r.person_id;
      when 'ic_no' then update persons set ic_no = v where id = r.person_id;
      when 'bank_name' then update persons set bank_name = v where id = r.person_id;
      when 'bank_account_no' then update persons set bank_account_no = v where id = r.person_id;
      when 'marital_status' then update persons set marital_status = v where id = r.person_id;
      when 'spouse_working' then update persons set spouse_working = v::boolean where id = r.person_id;
      when 'children_count' then update persons set children_count = coalesce(v, '0')::int where id = r.person_id;
      when 'epf_no' then update employments set epf_no = v where id = r.employment_id;
      when 'socso_no' then update employments set socso_no = v where id = r.employment_id;
      when 'tax_no' then update employments set tax_no = v where id = r.employment_id;
      else null;
    end case;
  end loop;
  update persons set updated_at = now() where id = r.person_id;
  -- Permohonan tukar bank lama yang masih menunggu tidak lagi relevan
  if r.changes::text like '%bank_account_no%' then
    update bank_change_requests set status = 'cancelled', decided_at = now(), note = 'Diganti oleh permohonan kemas kini profil'
     where person_id = r.person_id and status = 'pending';
  end if;
  return new;
end $$;
drop trigger if exists approval_profile_outcome_upd on approval_requests;
create trigger approval_profile_outcome_upd after update of status on approval_requests
  for each row execute function approval_profile_outcome();

-- 4. Ubah terus: tambah gambar profil & e-mel peribadi; bilangan anak kini perlu disahkan HR
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
  if d ? 'email' then
    if coalesce(d->>'email', '') <> '' and d->>'email' !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mel tidak sah'; end if;
    update persons set email = nullif(lower(trim(d->>'email')), '') where id = me;
  end if;
  if d ? 'photo_path' then
    if coalesce(d->>'photo_path', '') = '' or split_part(d->>'photo_path', '/', 1) <> me::text then raise exception 'Gambar tidak sah'; end if;
    update persons set photo_path = d->>'photo_path' where id = me;
  end if;
  if d ? 'avatar_path' then
    if coalesce(d->>'avatar_path', '') <> '' and split_part(d->>'avatar_path', '/', 1) <> me::text then raise exception 'Gambar tidak sah'; end if;
    update persons set avatar_path = nullif(d->>'avatar_path', '') where id = me;
  end if;
  if d ? 'children_count' then
    raise exception 'Bilangan anak perlu disahkan oleh HR. Gunakan "Mohon kemas kini".';
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

-- 5. Keluarga: pekerja boleh mengurus maklumat keluarga sendiri
drop policy if exists family_members_self on family_members;
create policy family_members_self on family_members for all to authenticated
  using (exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()))
  with check (exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function submit_profile_change(uuid, jsonb, text, action_channel, uuid) from public, anon;
    grant execute on function submit_profile_change(uuid, jsonb, text, action_channel, uuid) to authenticated;
    revoke all on function company_avatars(uuid) from public, anon;
    grant execute on function company_avatars(uuid) to authenticated;
    grant execute on function same_company_person(text) to authenticated;
    revoke all on function approval_profile_outcome() from public, anon, authenticated;
  end if;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('phrase', 'Kemas kini profil: ', 'Profile update: ', 123, true)
on conflict (kind, ms) do nothing;

-- 6. Senarai kelulusan: id pemohon (untuk gambar profil)
create or replace view v_my_approval_tasks with (security_invoker = true) as
 SELECT tk.id AS task_id, tk.step_name, tk.created_at AS assigned_at, tk.delegated_from, r.id AS request_id, r.request_type, r.title, r.context,
    r.ai_summary, r.sla_due_at, r.sla_breached, r.submitted_at, r.company_id, c.code AS company_code, p.full_name AS requester_name,
    p.photo_path AS requester_photo, d.name AS department, request_requester_name(r.id) AS requester_nickname,
    r.requester_person_id
   FROM approval_tasks tk
     JOIN approval_requests r ON r.id = tk.request_id
     JOIN companies c ON c.id = r.company_id
     LEFT JOIN persons p ON p.id = r.requester_person_id
     LEFT JOIN employments e ON e.id = r.requester_employment_id
     LEFT JOIN departments d ON d.id = e.department_id
  WHERE tk.status = 'pending'::task_status AND r.status = 'pending'::request_status AND tk.approver_person_id = current_person_id();
