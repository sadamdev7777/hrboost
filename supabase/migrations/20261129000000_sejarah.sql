-- =====================================================================
--  HR lebih mudah II (bahagian 3)
--  10. Sejarah perubahan pekerja: siapa mengubah jabatan, jawatan, status, gaji, peranan — dan bila.
--      Dicatat oleh pencetus (pelaku = current_person_id(); NULL = sistem / agent).
-- =====================================================================

create table if not exists employment_changes (
  id             bigint generated always as identity primary key,
  employment_id  uuid not null references employments(id) on delete cascade,
  field          text not null,
  old_value      text,
  new_value      text,
  note           text,
  changed_by     uuid references persons(id),
  changed_at     timestamptz not null default now()
);
create index if not exists employment_changes_emp on employment_changes(employment_id, changed_at desc);
alter table employment_changes enable row level security;
create policy read_changes on employment_changes for select using (has_role(employment_company(employment_id), '{hr,admin}'));

create or replace function trg_employment_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := current_person_id();
begin
  if new.department_id is distinct from old.department_id then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by)
    values (new.id, 'department', (select name from departments where id = old.department_id), (select name from departments where id = new.department_id), actor);
  end if;
  if new.position_id is distinct from old.position_id then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by)
    values (new.id, 'position', (select title from positions where id = old.position_id), (select title from positions where id = new.position_id), actor);
  end if;
  if new.employment_type is distinct from old.employment_type then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by) values (new.id, 'employment_type', old.employment_type::text, new.employment_type::text, actor);
  end if;
  if new.status is distinct from old.status then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by) values (new.id, 'status', old.status::text, new.status::text, actor);
  end if;
  if new.probation_end_date is distinct from old.probation_end_date then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by) values (new.id, 'probation_end', old.probation_end_date::text, new.probation_end_date::text, actor);
  end if;
  if new.contract_end_date is distinct from old.contract_end_date then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by) values (new.id, 'contract_end', old.contract_end_date::text, new.contract_end_date::text, actor);
  end if;
  if new.end_date is distinct from old.end_date then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by, note) values (new.id, 'end_date', old.end_date::text, new.end_date::text, actor, new.end_status::text);
  end if;
  if new.work_start is distinct from old.work_start then
    insert into employment_changes(employment_id, field, old_value, new_value, changed_by) values (new.id, 'work_start', to_char(old.work_start, 'HH24:MI'), to_char(new.work_start, 'HH24:MI'), actor);
  end if;
  return new;
end $$;
drop trigger if exists employment_changes_upd on employments;
create trigger employment_changes_upd after update on employments for each row execute function trg_employment_changes();

create or replace function trg_compensation_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare pc pay_components;
begin
  select * into pc from pay_components where id = new.component_id;
  insert into employment_changes(employment_id, field, old_value, new_value, note, changed_by)
  values (new.employment_id, 'pay:' || pc.code,
          (select to_char(x.amount, 'FM999,999,990.00') from employment_compensation x
            where x.employment_id = new.employment_id and x.component_id = new.component_id and x.id <> new.id
              and x.effective_from < new.effective_from order by x.effective_from desc limit 1),
          to_char(new.amount, 'FM999,999,990.00'), pc.name || ' mulai ' || to_char(new.effective_from, 'DD/MM/YYYY'), current_person_id());
  return new;
end $$;
drop trigger if exists compensation_changes_ins on employment_compensation;
create trigger compensation_changes_ins after insert on employment_compensation for each row execute function trg_compensation_changes();

create or replace function trg_role_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare r user_roles := coalesce(new, old); e uuid;
begin
  select id into e from employments where person_id = r.person_id and company_id = r.company_id order by (status in ('probation','active')) desc, join_date desc limit 1;
  if e is not null then
    begin
      insert into employment_changes(employment_id, field, old_value, new_value, changed_by)
      values (e, 'role', case when tg_op = 'DELETE' then r.role::text end, case when tg_op = 'INSERT' then r.role::text end, current_person_id());
    exception when foreign_key_violation then null;  -- pekerjaan sedang dipadam bersama
    end;
  end if;
  return null;
end $$;
drop trigger if exists role_changes on user_roles;
create trigger role_changes after insert or delete on user_roles for each row execute function trg_role_changes();

-- Garis masa: perubahan + peristiwa penting (mula kerja, surat, penilaian, dokumen) + log akses (pilihan)
create or replace function employment_history(p_employment uuid, p_include_access boolean default false)
returns table(at timestamptz, kind text, field text, old_value text, new_value text, note text, actor text)
language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select * from (
    select c.changed_at, 'change'::text, c.field, c.old_value, c.new_value, c.note, coalesce(p.preferred_name, p.full_name)
      from employment_changes c left join persons p on p.id = c.changed_by where c.employment_id = e.id
    union all
    select e.created_at, 'event', 'joined', null, e.join_date::text, null, null::text
    union all
    select l.issued_at, 'event', 'letter', null, l.ref_no, case l.kind when 'salary' then 'Surat pengesahan gaji' else 'Surat pengesahan majikan' end,
           coalesce(p.preferred_name, p.full_name)
      from letter_requests l left join persons p on p.id = l.issued_by where l.employment_id = e.id and l.status = 'issued'
    union all
    select r.submitted_at, 'event', 'probation_review', null, r.recommendation, r.comments, coalesce(p.preferred_name, p.full_name)
      from probation_reviews r join persons p on p.id = r.reviewer_id where r.employment_id = e.id
    union all
    select d.created_at, 'event', 'document', null, d.title, d.doc_type, coalesce(p.preferred_name, p.full_name)
      from employee_documents d left join persons p on p.id = d.uploaded_by where d.employment_id = e.id
    union all
    select a.created_at, 'access', a.resource, null, null, a.via::text, coalesce(p.preferred_name, p.full_name)
      from data_access_log a left join persons p on p.id = a.actor_person_id
     where p_include_access and a.subject_person_id = e.person_id
  ) x order by 1 desc limit 300;
end $$;

do $$
declare f text;
begin
  foreach f in array array['trg_employment_changes()', 'trg_compensation_changes()', 'trg_role_changes()', 'employment_history(uuid, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f = 'employment_history(uuid, boolean)' then
        execute format('grant execute on function %s to authenticated, service_role', f);
      else
        execute format('revoke all on function %s from authenticated', f);
      end if;
    end if;
  end loop;
end $$;
