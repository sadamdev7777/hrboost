-- =====================================================================
--  Rekod dipadam: padam dengan sejarah + pulihkan
--  Setiap padam menyimpan salinan penuh rekod (dan rekod anak) dalam deleted_records, kemudian
--  memadam rekod asal. Pulihkan memasukkan semula salinan itu. Rekod disimpan kekal (tiada pembuangan
--  automatik). Rekod berkanun (gaji, pekerja, permohonan yang dihantar) TIDAK boleh dipadam di sini.
-- =====================================================================

create table if not exists deleted_records (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete cascade,
  entity       text not null,
  record_id    uuid not null,
  label        text not null,
  detail       text,
  snapshot     jsonb not null,
  children     jsonb not null default '{}'::jsonb,
  reason       text,
  deleted_by   uuid references persons(id) on delete set null,
  deleted_at   timestamptz not null default now(),
  restored_at  timestamptz,
  restored_by  uuid references persons(id) on delete set null
);
create index if not exists deleted_records_company_idx on deleted_records(company_id, deleted_at desc);
alter table deleted_records enable row level security;
-- Tiada polisi: hanya melalui RPC security definer di bawah.

-- ---------------------------------------------------------------- Konfigurasi entiti
-- jadual, lajur kunci anak (jadual:lajur), label paparan
create or replace function _rd_jadual(p_entity text) returns text
language sql immutable as $$
  select case p_entity
    when 'letter' then 'letter_requests'
    when 'announcement' then 'announcements'
    when 'department' then 'departments'
    when 'asset' then 'company_assets'
    when 'document' then 'employee_documents'
    when 'family' then 'family_members'
    when 'training' then 'trainings'
    when 'timeline' then 'job_timeline'
    when 'checklist' then 'onboarding_checklist_items'
    when 'delegation' then 'approval_delegations'
    when 'question' then 'hr_questions'
    when 'appraisal_cycle' then 'appraisal_cycles'
    when 'kb_doc' then 'ai_knowledge_docs'
    when 'tp1' then 'tp1_reliefs'
    when 'claim_draft' then 'claims'
  end
$$;

create or replace function _rd_anak(p_entity text) returns text[]
language sql immutable as $$
  select case p_entity
    when 'announcement' then array['announcement_reads:announcement_id']
    when 'kb_doc' then array['ai_knowledge_chunks:doc_id']
    when 'claim_draft' then array['claim_items:claim_id']
    else array[]::text[]
  end
$$;

-- Masukkan semula satu baris jsonb ke jadual (lajur dijana dilangkau)
create or replace function _rd_masuk(p_table text, p_row jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ',' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table and is_generated = 'NEVER';
  execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)', p_table, cols, cols, p_table) using p_row;
end $$;

-- Syarikat bagi satu rekod (company_id terus, atau melalui employment_id)
create or replace function _rd_syarikat(p_row jsonb) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((p_row->>'company_id')::uuid, (select e.company_id from employments e where e.id = (p_row->>'employment_id')::uuid))
$$;

-- Label & butiran paparan
create or replace function _rd_label(p_entity text, r jsonb, out label text, out detail text)
language plpgsql stable security definer set search_path = public as $$
declare nama text;
begin
  if r ? 'employment_id' then
    select coalesce(p.preferred_name, p.full_name) into nama from employments e join persons p on p.id = e.person_id where e.id = (r->>'employment_id')::uuid;
  end if;
  label := case p_entity
    when 'letter' then coalesce(r->>'ref_no', r->>'kind')
    when 'announcement' then r->>'title'
    when 'department' then r->>'name'
    when 'asset' then r->>'name'
    when 'document' then coalesce(r->>'title', r->>'doc_type')
    when 'family' then r->>'name'
    when 'training' then r->>'title'
    when 'timeline' then r->>'event'
    when 'checklist' then r->>'title'
    when 'delegation' then (select coalesce(p.preferred_name, p.full_name) from persons p where p.id = (r->>'from_person_id')::uuid)
                           || ' → ' || (select coalesce(p.preferred_name, p.full_name) from persons p where p.id = (r->>'to_person_id')::uuid)
    when 'question' then left(r->>'question', 80)
    when 'appraisal_cycle' then r->>'name'
    when 'kb_doc' then r->>'title'
    when 'tp1' then r->>'category'
    when 'claim_draft' then r->>'title'
  end;
  label := coalesce(nullif(label, ''), '-');
  detail := case p_entity
    when 'letter' then concat_ws(' · ', r->>'kind', nama)
    when 'tp1' then concat_ws(' · ', nama, (r->>'year') || '/' || (r->>'month'), 'RM' || (r->>'amount'))
    when 'claim_draft' then concat_ws(' · ', nama, 'RM' || (r->>'total_amount'))
    else nama
  end;
end $$;

-- Siapa boleh padam / pulihkan
create or replace function _rd_boleh(p_entity text, r jsonb, p_company uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_entity = 'claim_draft' then
    return exists (select 1 from employments e where e.id = (r->>'employment_id')::uuid and e.person_id = current_person_id());
  end if;
  if p_entity = 'asset' and (r->>'created_by')::uuid = current_person_id() and r->>'status' in ('pending', 'rejected') then
    return true;
  end if;
  if p_entity = 'letter' and r->>'kind' = 'salary_advance' then
    return has_role(p_company, '{hr,admin,finance}');
  end if;
  if p_entity = 'announcement' then
    return has_role(p_company, '{hr,ceo,admin}');
  end if;
  return has_role(p_company, '{hr,admin}');
end $$;

-- ---------------------------------------------------------------- Padam
create or replace function record_delete(p_entity text, p_id uuid, p_reason text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tbl text := _rd_jadual(p_entity);
  r jsonb; co uuid; anak jsonb := '{}'::jsonb; a text; t text; k text; rows jsonb; lbl record; rid uuid;
begin
  if tbl is null then raise exception 'Jenis rekod tidak boleh dipadam'; end if;
  execute format('select to_jsonb(x) from %I x where x.id = $1', tbl) into r using p_id;
  if r is null then raise exception 'Rekod tidak dijumpai'; end if;
  co := _rd_syarikat(r);
  if not _rd_boleh(p_entity, r, co) then raise exception 'Tidak dibenarkan'; end if;

  -- Peraturan khusus
  if p_entity = 'department' and exists (select 1 from employments where department_id = p_id and status in ('probation','active')) then
    raise exception 'Jabatan ini masih mempunyai pekerja. Pindahkan pekerja dahulu.';
  end if;
  if p_entity = 'appraisal_cycle' and (r->>'status' <> 'draft' or exists (select 1 from appraisals where cycle_id = p_id)) then
    raise exception 'Hanya kitaran penilaian draf yang belum dibuka boleh dipadam.';
  end if;
  if p_entity = 'claim_draft' and r->>'status' <> 'draft' then
    raise exception 'Hanya draf tuntutan boleh dipadam. Tuntutan yang dihantar boleh dibatalkan.';
  end if;
  if p_entity = 'letter' and r->>'status' = 'issued' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Sila nyatakan sebab memadam surat yang telah dikeluarkan.';
  end if;

  -- Salinan rekod anak
  foreach a in array _rd_anak(p_entity) loop
    t := split_part(a, ':', 1); k := split_part(a, ':', 2);
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x where x.%I = $1', t, k) into rows using p_id;
    anak := anak || jsonb_build_object(t, rows);
  end loop;

  lbl := _rd_label(p_entity, r);
  insert into deleted_records(company_id, entity, record_id, label, detail, snapshot, children, reason, deleted_by)
  values (co, p_entity, p_id, lbl.label, lbl.detail, r, anak, nullif(btrim(p_reason), ''), current_person_id())
  returning id into rid;

  -- Padam (anak dipadam dahulu, sesetengahnya tiada ON DELETE CASCADE)
  foreach a in array _rd_anak(p_entity) loop
    execute format('delete from %I where %I = $1', split_part(a, ':', 1), split_part(a, ':', 2)) using p_id;
  end loop;
  execute format('delete from %I where id = $1', tbl) using p_id;
  return rid;
end $$;

-- ---------------------------------------------------------------- Pulihkan
create or replace function record_restore(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d deleted_records; tbl text; t text; x jsonb;
begin
  select * into d from deleted_records where id = p_id for update;
  if d.id is null then raise exception 'Rekod tidak dijumpai'; end if;
  if d.restored_at is not null then raise exception 'Rekod ini telah dipulihkan.'; end if;
  if not _rd_boleh(d.entity, d.snapshot, d.company_id) then raise exception 'Tidak dibenarkan'; end if;
  tbl := _rd_jadual(d.entity);
  begin
    perform _rd_masuk(tbl, d.snapshot);
    for t in select jsonb_object_keys(d.children) loop
      for x in select jsonb_array_elements(d.children->t) loop
        perform _rd_masuk(t, x);
      end loop;
    end loop;
  exception
    when unique_violation then raise exception 'Tidak dapat dipulihkan: rekod dengan nama atau nombor yang sama sudah wujud.';
    when foreign_key_violation then raise exception 'Tidak dapat dipulihkan: rekod berkaitan (cth. pekerja atau jabatan) sudah tiada.';
  end;
  update deleted_records set restored_at = now(), restored_by = current_person_id() where id = d.id;
  return d.record_id;
end $$;

-- ---------------------------------------------------------------- Senarai (HR / Pentadbir; pekerja: rekod sendiri)
create or replace function deleted_records_list(p_company uuid, p_include_restored boolean default false)
returns table(id uuid, entity text, record_id uuid, label text, detail text, reason text, deleted_by text, deleted_at timestamptz,
              restored_at timestamptz, restored_by text, can_restore boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_company_member(p_company) then raise exception 'Tidak dibenarkan'; end if;
  return query
  select d.id, d.entity, d.record_id, d.label, d.detail, d.reason,
         coalesce(p1.preferred_name, p1.full_name), d.deleted_at, d.restored_at, coalesce(p2.preferred_name, p2.full_name),
         d.restored_at is null and _rd_boleh(d.entity, d.snapshot, d.company_id)
    from deleted_records d
    left join persons p1 on p1.id = d.deleted_by
    left join persons p2 on p2.id = d.restored_by
   where d.company_id = p_company
     and (p_include_restored or d.restored_at is null)
     and (has_role(p_company, '{hr,admin}') or d.deleted_by = current_person_id())
   order by d.deleted_at desc
   limit 500;
end $$;

-- ---------------------------------------------------------------- Pengumuman: keluarkan daripada arkib
create or replace function unarchive_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update announcements set archived_at = null where id = p_id and has_role(company_id, '{hr,ceo,admin}') and archived_at is not null;
  if not found then raise exception 'Tidak dibenarkan'; end if;
end $$;

-- ---------------------------------------------------------------- Laluan padam sedia ada → dengan sejarah
create or replace function inventory_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a company_assets;
begin
  select * into a from company_assets where id = p_id;
  if a.id is null then raise exception 'Item tidak dijumpai'; end if;
  if not (has_role(a.company_id, '{hr,admin}') or (a.created_by = current_person_id() and a.status in ('pending','rejected'))) then
    raise exception 'Item ini telah disahkan. Hubungi HR untuk membuangnya.';
  end if;
  perform record_delete('asset', p_id, null);
end $$;

create or replace function onboarding_delete_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform record_delete('checklist', p_item, null);
end $$;

do $$
declare f text;
begin
  foreach f in array array['_rd_masuk(text,jsonb)', '_rd_syarikat(jsonb)', '_rd_label(text,jsonb)', '_rd_boleh(text,jsonb,uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
    end if;
  end loop;
  foreach f in array array['record_delete(text,uuid,text)', 'record_restore(uuid)', 'deleted_records_list(uuid,boolean)', 'unarchive_announcement(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- No. rujukan surat tidak diulang selepas padam
-- Nombor seterusnya = nombor terbesar tahun ini (termasuk surat yang dipadam) + 1
create or replace function letter_next_ref(p_company uuid) returns text
language plpgsql security definer set search_path = public as $$
declare seq int; kod text := (select code from companies where id = p_company); awalan text;
begin
  perform pg_advisory_xact_lock(hashtext('letter_ref:' || p_company::text));
  awalan := kod || '/HR/' || to_char(now(), 'YYYY') || '/';
  select coalesce(max(n), 0) + 1 into seq from (
    select nullif(regexp_replace(ref_no, '^.*/', ''), '')::int n from letter_requests
     where company_id = p_company and ref_no like awalan || '%'
    union all
    select nullif(regexp_replace(snapshot->>'ref_no', '^.*/', ''), '')::int from deleted_records
     where company_id = p_company and entity = 'letter' and snapshot->>'ref_no' like awalan || '%'
  ) x;
  return awalan || lpad(seq::text, 4, '0');
end $$;

create or replace function issue_letter(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare l letter_requests; e employments; ruj text; tandatangan jsonb;
begin
  select * into l from letter_requests where id = p_id for update;
  if l.id is null or not has_role(l.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if l.status <> 'pending' then raise exception 'Permohonan ini telah diproses'; end if;
  ruj := letter_next_ref(l.company_id);
  select jsonb_build_object('name', coalesce(pe.full_name, pe.preferred_name), 'position', coalesce(po.title, 'Pengurus Sumber Manusia'))
    into tandatangan
    from persons pe left join employments em on em.person_id = pe.id and em.company_id = l.company_id and em.status in ('probation','active')
    left join positions po on po.id = em.position_id
   where pe.id = current_person_id() limit 1;
  update letter_requests set status = 'issued', ref_no = ruj, issued_at = now(), issued_by = current_person_id(),
         snapshot = letter_build_snapshot(l.id) || jsonb_build_object('signatory', tandatangan)
   where id = l.id;
  select * into e from employments where id = l.employment_id;
  if l.kind = 'salary' then
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'salary_letter', 'web');
  end if;
  perform notify_person(e.person_id, l.company_id,
    'Surat ' || case l.kind when 'salary' then 'pengesahan gaji' else 'pengesahan majikan' end || ' anda telah dikeluarkan (' || ruj ||
    '). Muat turun di HRBoost → Mohon → Surat.');
  return ruj;
end $$;
