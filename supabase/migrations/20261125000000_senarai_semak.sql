-- =====================================================================
--  Senarai semak pekerja baharu (HR & ketua jabatan)
--  Templat lalai disimpan sebagai DATA (platform_settings) dan disalin ke
--  setiap pekerjaan baharu. HR boleh menambah perkara khas bagi seseorang.
--  Juga: import gaji pokok & baki cuti awal secara pukal (Excel).
-- =====================================================================

insert into platform_settings(key, value) values ('onboarding_checklist_default', '[
  {"owner":"hr","title":"Surat tawaran ditandatangani dan disimpan dalam Dokumen","from":"join","offset":-3},
  {"owner":"hr","title":"Tetapkan gaji pokok dan elaun tetap","from":"join","offset":-3},
  {"owner":"hr","title":"Daftar pekerja dengan KWSP, PERKESO dan SIP","from":"join","offset":0},
  {"owner":"hr","title":"Sahkan akaun bank dan maklumat cukai","from":"join","offset":7},
  {"owner":"ketua","title":"Sediakan meja, peralatan dan akses sistem","from":"join","offset":-1},
  {"owner":"ketua","title":"Taklimat hari pertama dan perkenalan pasukan","from":"join","offset":0},
  {"owner":"ketua","title":"Tetapkan rakan pembimbing","from":"join","offset":1},
  {"owner":"ketua","title":"Semakan prestasi 30 hari","from":"join","offset":30},
  {"owner":"ketua","title":"Cadangan pengesahan jawatan kepada HR","from":"probation_end","offset":-14}
]') on conflict (key) do nothing;

create table if not exists onboarding_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  employment_id  uuid not null references employments(id) on delete cascade,
  company_id     uuid not null references companies(id) on delete cascade,
  owner          text not null check (owner in ('hr','ketua')),
  title          text not null check (length(title) between 1 and 200),
  due_date       date,
  sort           int not null default 0,
  done_at        timestamptz,
  done_by        uuid references persons(id),
  created_at     timestamptz not null default now()
);
create index if not exists onboarding_checklist_emp on onboarding_checklist_items(employment_id);
create index if not exists onboarding_checklist_open on onboarding_checklist_items(company_id) where done_at is null;
alter table onboarding_checklist_items enable row level security;
create policy read_checklist on onboarding_checklist_items for select
  using (has_role(company_id, '{hr,admin}') or can_view_employment(employment_id));

-- Salin templat ke satu pekerjaan
create or replace function onboarding_seed_checklist(p_employment uuid) returns int
language plpgsql security definer set search_path = public as $$
declare e employments; t jsonb; x jsonb; i int := 0; asas date;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or exists (select 1 from onboarding_checklist_items where employment_id = e.id) then return 0; end if;
  t := coalesce((select value from platform_settings where key = 'onboarding_checklist_default'), '[]');
  for x in select * from jsonb_array_elements(t) loop
    i := i + 1;
    asas := case when x->>'from' = 'probation_end' then e.probation_end_date else e.join_date end;
    continue when asas is null;
    insert into onboarding_checklist_items(employment_id, company_id, owner, title, due_date, sort)
    values (e.id, e.company_id, x->>'owner', x->>'title', asas + coalesce((x->>'offset')::int, 0), i);
  end loop;
  return i;
end $$;

create or replace function trg_onboarding_checklist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Hanya pekerja yang baru / akan mula (bukan import rekod lama)
  if new.join_date >= current_date - 30 and new.status in ('probation','active') then
    perform onboarding_seed_checklist(new.id);
  end if;
  return new;
end $$;
drop trigger if exists onboarding_checklist_ins on employments;
create trigger onboarding_checklist_ins after insert on employments for each row execute function trg_onboarding_checklist();

-- Pekerja baharu sedia ada (30 hari kebelakangan / akan mula)
select onboarding_seed_checklist(id) from employments where join_date >= current_date - 30 and status in ('probation','active');

-- Siapa boleh menanda: HR / Pentadbir untuk semua; ketua jabatan / pengurus untuk perkara "ketua"
create or replace function onboarding_can_act(p_item onboarding_checklist_items) returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(p_item.company_id, '{hr,admin}')
      or (p_item.owner = 'ketua' and exists (
            select 1 from employments e left join departments d on d.id = e.department_id
             where e.id = p_item.employment_id
               and (e.manager_person_id = current_person_id() or d.head_person_id = current_person_id())))
$$;

create or replace function onboarding_checklist(p_employment uuid)
returns table(id uuid, owner text, title text, due_date date, done_at timestamptz, done_by_name text, can_act boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (has_role(employment_company(p_employment), '{hr,admin}') or exists (
      select 1 from employments e left join departments d on d.id = e.department_id
       where e.id = p_employment and (e.manager_person_id = current_person_id() or d.head_person_id = current_person_id()))) then
    raise exception 'Tidak dibenarkan';
  end if;
  return query
  select c.id, c.owner, c.title, c.due_date, c.done_at, coalesce(p.preferred_name, p.full_name), onboarding_can_act(c)
    from onboarding_checklist_items c left join persons p on p.id = c.done_by
   where c.employment_id = p_employment
   order by c.owner, c.due_date nulls last, c.sort;
end $$;

create or replace function onboarding_toggle(p_item uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c onboarding_checklist_items;
begin
  select * into c from onboarding_checklist_items where id = p_item;
  if c.id is null or not onboarding_can_act(c) then raise exception 'Tidak dibenarkan'; end if;
  update onboarding_checklist_items
     set done_at = case when p_done then now() end, done_by = case when p_done then current_person_id() end
   where id = c.id;
end $$;

create or replace function onboarding_add_item(p_employment uuid, p_owner text, p_title text, p_due date) returns uuid
language plpgsql security definer set search_path = public as $$
declare e employments; nid uuid;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if p_owner not in ('hr','ketua') then raise exception 'Pemilik tidak sah'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Sila isi perkara'; end if;
  insert into onboarding_checklist_items(employment_id, company_id, owner, title, due_date, sort)
  values (e.id, e.company_id, p_owner, trim(p_title), p_due, 100) returning id into nid;
  return nid;
end $$;

create or replace function onboarding_delete_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c onboarding_checklist_items;
begin
  select * into c from onboarding_checklist_items where id = p_item;
  if c.id is null or not has_role(c.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  delete from onboarding_checklist_items where id = c.id;
end $$;

-- Perkara belum selesai yang menjadi tanggungjawab saya (HR: owner 'hr'; ketua: pasukan sendiri)
create or replace function my_onboarding_tasks(p_company uuid)
returns table(id uuid, employment_id uuid, employee_name text, owner text, title text, due_date date)
language sql stable security definer set search_path = public as $$
  select c.id, c.employment_id, coalesce(p.preferred_name, p.full_name), c.owner, c.title, c.due_date
    from onboarding_checklist_items c
    join employments e on e.id = c.employment_id and e.status in ('probation','active')
    join persons p on p.id = e.person_id
    left join departments d on d.id = e.department_id
   where c.company_id = p_company and c.done_at is null
     and ( (c.owner = 'hr' and has_role(p_company, '{hr,admin}'))
        or (c.owner = 'ketua' and (e.manager_person_id = current_person_id() or d.head_person_id = current_person_id())) )
   order by c.due_date nulls last, c.sort
$$;

-- ---------------------------------------------------------------------
-- Import pukal dari Excel
-- ---------------------------------------------------------------------
-- Gaji pokok: [{"employee_no":"MTB001","basic":3500,"effective_from":"2026-11-01"}]
create or replace function hr_import_basic_pay(p_company uuid, p_rows jsonb)
returns table(employee_no text, ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare r jsonb; e employments; amt numeric; eff date; v_no text;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan / Pentadbir'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    v_no := trim(coalesce(r->>'employee_no', '')); employee_no := v_no;
    select * into e from employments x where x.company_id = p_company and upper(x.employee_no) = upper(v_no) and x.status in ('probation','active');
    if e.id is null then ok := false; message := 'No. pekerja tidak dijumpai'; return next; continue; end if;
    begin
      amt := round((r->>'basic')::numeric, 2);
      eff := coalesce(nullif(r->>'effective_from', '')::date, greatest(date_trunc('month', current_date)::date, e.join_date));
      perform hr_set_pay(e.id, jsonb_build_object('BASIC', amt), eff, 'web');
      ok := true; message := 'RM' || to_char(amt, 'FM999,999,990.00') || ' mulai ' || to_char(eff, 'DD/MM/YYYY');
    exception when others then
      ok := false; message := case when sqlstate = '22P02' or sqlstate = '22007' or sqlstate = '22008' then 'Nilai tidak sah' else sqlerrm end;
    end;
    return next;
  end loop;
end $$;

-- Baki cuti awal: [{"employee_no":"MTB001","leave_code":"AL","carried_forward":3,"taken":5}]
--  carried_forward = dibawa dari tahun lepas; taken = telah diambil sebelum menggunakan HRBoost (ditolak melalui pelarasan)
create or replace function hr_import_leave_opening(p_company uuid, p_year int, p_rows jsonb)
returns table(employee_no text, leave_code text, ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare r jsonb; e employments; lt leave_types; cf numeric; tk numeric; b leave_balances; v_no text;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    v_no := trim(coalesce(r->>'employee_no', '')); employee_no := v_no; leave_code := upper(trim(coalesce(r->>'leave_code', 'AL')));
    select * into e from employments x where x.company_id = p_company and upper(x.employee_no) = upper(v_no) and x.status in ('probation','active');
    if e.id is null then ok := false; message := 'No. pekerja tidak dijumpai'; return next; continue; end if;
    select * into lt from leave_types x where x.company_id = p_company and upper(x.code) = leave_code;
    if lt.id is null then ok := false; message := 'Kod cuti tidak dijumpai'; return next; continue; end if;
    begin
      cf := coalesce(nullif(r->>'carried_forward', '')::numeric, 0);
      tk := coalesce(nullif(r->>'taken', '')::numeric, 0);
    exception when others then ok := false; message := 'Nilai tidak sah'; return next; continue;
    end;
    if cf < 0 or tk < 0 or cf > 366 or tk > 366 then ok := false; message := 'Nilai di luar julat'; return next; continue; end if;
    perform ensure_leave_balance(e.id, lt.id, p_year);
    update leave_balances set carried_forward = cf, adjustment = -tk
     where employment_id = e.id and leave_type_id = lt.id and year = p_year
     returning * into b;
    if b.id is null then ok := false; message := 'Baki tidak dapat dicipta'; return next; continue; end if;
    ok := true; message := 'Baki kini ' || rtrim(rtrim(b.available::text, '0'), '.') || ' hari';
    return next;
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['onboarding_seed_checklist(uuid)', 'onboarding_can_act(onboarding_checklist_items)', 'onboarding_checklist(uuid)',
    'onboarding_toggle(uuid, boolean)', 'onboarding_add_item(uuid, text, text, date)', 'onboarding_delete_item(uuid)',
    'my_onboarding_tasks(uuid)', 'hr_import_basic_pay(uuid, jsonb)', 'hr_import_leave_opening(uuid, int, jsonb)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f = 'onboarding_seed_checklist(uuid)' then
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;
