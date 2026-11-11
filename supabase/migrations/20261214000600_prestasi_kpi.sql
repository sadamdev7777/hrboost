-- =====================================================================
--  Penilaian prestasi & KPI ringkas
--  Kitaran (HR) → setiap pekerja: KPI/matlamat dengan pemberat → penilaian kendiri (pekerja)
--  → penilaian pelulus (ketua jabatan / pengurus) → HR muktamadkan → pekerja dimaklumkan.
--  Skala 1–5. Markah keseluruhan = purata berwajaran markah pelulus.
--  Semua akses melalui RPC (RLS tanpa polisi baca terus kecuali HR).
-- =====================================================================

create table if not exists appraisal_cycles (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  period_start  date not null,
  period_end    date not null,
  self_due      date,
  manager_due   date,
  template      jsonb not null default '[]',   -- KPI lalai: [{title, description, weight, target}]
  status        text not null default 'draft' check (status in ('draft','open','closed')),
  created_by    uuid references persons(id),
  created_at    timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists appraisals (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references appraisal_cycles(id) on delete cascade,
  employment_id      uuid not null references employments(id) on delete cascade,
  reviewer_person_id uuid references persons(id),
  status             text not null default 'self' check (status in ('self','manager','hr','final')),
  self_comment       text,
  manager_comment    text,
  hr_note            text,
  manager_rating     numeric(3,2),
  final_rating       numeric(3,2),
  self_submitted_at  timestamptz,
  manager_submitted_at timestamptz,
  finalised_at       timestamptz,
  unique (cycle_id, employment_id)
);
create index if not exists appraisals_reviewer_idx on appraisals(reviewer_person_id, status);

create table if not exists appraisal_items (
  id             uuid primary key default gen_random_uuid(),
  appraisal_id   uuid not null references appraisals(id) on delete cascade,
  title          text not null,
  description    text,
  target         text,
  weight         int not null default 1 check (weight between 1 and 100),
  self_score     int check (self_score between 1 and 5),
  self_note      text,
  manager_score  int check (manager_score between 1 and 5),
  manager_note   text,
  sort_order     int not null default 0
);

alter table appraisal_cycles enable row level security;
alter table appraisals enable row level security;
alter table appraisal_items enable row level security;
drop policy if exists appraisal_cycles_hr on appraisal_cycles;
create policy appraisal_cycles_hr on appraisal_cycles for select using (has_role(company_id, '{hr,ceo,admin}'));

-- ---------------------------------------------------------------- Pembantu
create or replace function appraisal_template_valid(p jsonb) returns jsonb
language plpgsql immutable as $$
declare x jsonb; out jsonb := '[]';
begin
  if p is null or jsonb_typeof(p) <> 'array' then return '[]'; end if;
  for x in select * from jsonb_array_elements(p) loop
    continue when coalesce(trim(x->>'title'), '') = '';
    out := out || jsonb_build_array(jsonb_build_object(
      'title', left(trim(x->>'title'), 200), 'description', left(nullif(trim(x->>'description'), ''), 1000),
      'target', left(nullif(trim(x->>'target'), ''), 300),
      'weight', greatest(1, least(100, coalesce((x->>'weight')::int, 1)))));
  end loop;
  if jsonb_array_length(out) > 20 then raise exception 'Maksimum 20 KPI'; end if;
  return out;
end $$;

-- ---------------------------------------------------------------- HR: kitaran
create or replace function hr_appraisal_cycle_save(p_company uuid, p_data jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare d jsonb := coalesce(p_data, '{}'); cid uuid := p_id; c appraisal_cycles;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if coalesce(trim(d->>'name'), '') = '' then raise exception 'Sila namakan kitaran penilaian'; end if;
  if (d->>'period_start')::date is null or (d->>'period_end')::date is null or (d->>'period_end')::date < (d->>'period_start')::date then
    raise exception 'Tempoh penilaian tidak sah';
  end if;
  if cid is null then
    insert into appraisal_cycles(company_id, name, period_start, period_end, self_due, manager_due, template, created_by)
    values (p_company, trim(d->>'name'), (d->>'period_start')::date, (d->>'period_end')::date,
            nullif(d->>'self_due', '')::date, nullif(d->>'manager_due', '')::date, appraisal_template_valid(d->'template'), current_person_id())
    returning id into cid;
  else
    select * into c from appraisal_cycles where id = cid and company_id = p_company;
    if c.id is null then raise exception 'Kitaran tidak dijumpai'; end if;
    if c.status = 'closed' then raise exception 'Kitaran telah ditutup'; end if;
    update appraisal_cycles set name = trim(d->>'name'), period_start = (d->>'period_start')::date, period_end = (d->>'period_end')::date,
           self_due = nullif(d->>'self_due', '')::date, manager_due = nullif(d->>'manager_due', '')::date,
           template = case when c.status = 'draft' then appraisal_template_valid(d->'template') else template end
     where id = cid;
  end if;
  return cid;
end $$;

-- Buka kitaran: cipta penilaian bagi pekerja aktif (semua, atau senarai), pelulus = pengurus / ketua jabatan
create or replace function hr_appraisal_cycle_open(p_cycle uuid, p_employments uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare c appraisal_cycles; e record; aid uuid; n int := 0; x jsonb; i int;
begin
  select * into c from appraisal_cycles where id = p_cycle;
  if c.id is null or not has_role(c.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if c.status = 'closed' then raise exception 'Kitaran telah ditutup'; end if;
  for e in
    select em.id, em.person_id, coalesce(em.manager_person_id, d.head_person_id) as reviewer
      from employments em left join departments d on d.id = em.department_id
     where em.company_id = c.company_id and em.status in ('probation','active') and em.join_date <= c.period_end
       and (p_employments is null or em.id = any(p_employments))
       and not exists (select 1 from appraisals a where a.cycle_id = c.id and a.employment_id = em.id)
  loop
    insert into appraisals(cycle_id, employment_id, reviewer_person_id)
    values (c.id, e.id, case when e.reviewer is distinct from e.person_id then e.reviewer end)
    returning id into aid;
    i := 0;
    for x in select * from jsonb_array_elements(c.template) loop
      insert into appraisal_items(appraisal_id, title, description, target, weight, sort_order)
      values (aid, x->>'title', x->>'description', x->>'target', coalesce((x->>'weight')::int, 1), i);
      i := i + 1;
    end loop;
    perform notify_person(e.person_id, c.company_id,
      'Penilaian prestasi ' || c.name || ' telah dibuka. Sila isi penilaian kendiri anda' ||
      coalesce(' sebelum ' || to_char(c.self_due, 'DD/MM/YYYY'), '') || ' di HRBoost → Saya → Penilaian prestasi.');
    n := n + 1;
  end loop;
  update appraisal_cycles set status = 'open' where id = c.id;
  return n;
end $$;

create or replace function hr_appraisal_cycle_close(p_cycle uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c appraisal_cycles;
begin
  select * into c from appraisal_cycles where id = p_cycle;
  if c.id is null or not has_role(c.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  update appraisal_cycles set status = 'closed' where id = c.id;
end $$;

create or replace function hr_appraisal_cycles(p_company uuid)
returns table(id uuid, name text, period_start date, period_end date, self_due date, manager_due date, status text, template jsonb,
              total bigint, self_done bigint, manager_done bigint, final_done bigint, avg_rating numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.period_start, c.period_end, c.self_due, c.manager_due, c.status, c.template,
         count(a.id), count(a.id) filter (where a.status <> 'self'), count(a.id) filter (where a.status in ('hr','final')),
         count(a.id) filter (where a.status = 'final'), round(avg(a.final_rating), 2)
    from appraisal_cycles c left join appraisals a on a.cycle_id = c.id
   where c.company_id = p_company and has_role(p_company, '{hr,ceo,admin}')
   group by c.id order by c.period_end desc, c.name
$$;

create or replace function hr_appraisal_list(p_cycle uuid)
returns table(id uuid, employment_id uuid, employee_no text, name text, department text, reviewer text, status text,
              manager_rating numeric, final_rating numeric, self_submitted_at timestamptz, manager_submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.employment_id, e.employee_no, coalesce(p.preferred_name, p.full_name), d.name,
         (select coalesce(r.preferred_name, r.full_name) from persons r where r.id = a.reviewer_person_id),
         a.status, a.manager_rating, a.final_rating, a.self_submitted_at, a.manager_submitted_at
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id
    join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
    left join departments d on d.id = e.department_id
   where a.cycle_id = p_cycle and has_role(c.company_id, '{hr,ceo,admin}')
   order by d.name nulls last, coalesce(p.preferred_name, p.full_name)
$$;

-- ---------------------------------------------------------------- Akses satu penilaian
create or replace function appraisal_role(a appraisals) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from employments e where e.id = a.employment_id and e.person_id = current_person_id()) then 'self'
    when a.reviewer_person_id = current_person_id() then 'reviewer'
    when has_role((select company_id from appraisal_cycles where id = a.cycle_id), '{hr,admin}') then 'hr'
    when has_role((select company_id from appraisal_cycles where id = a.cycle_id), '{ceo}') then 'ceo'
  end
$$;

create or replace function appraisal_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a appraisals; c appraisal_cycles; peranan text; tunjuk_pelulus boolean;
begin
  select * into a from appraisals where id = p_id;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  peranan := appraisal_role(a);
  if peranan is null then raise exception 'Tidak dibenarkan'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  -- Pekerja melihat markah pelulus hanya selepas dimuktamadkan
  tunjuk_pelulus := peranan <> 'self' or a.status = 'final';
  return jsonb_build_object(
    'id', a.id, 'role', peranan, 'status', a.status,
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'period_start', c.period_start, 'period_end', c.period_end,
                                'self_due', c.self_due, 'manager_due', c.manager_due, 'status', c.status),
    'employee', (select jsonb_build_object('name', coalesce(p.preferred_name, p.full_name), 'employee_no', e.employee_no,
                                           'position', (select title from positions where id = e.position_id),
                                           'department', (select name from departments where id = e.department_id))
                   from employments e join persons p on p.id = e.person_id where e.id = a.employment_id),
    'reviewer', (select coalesce(preferred_name, full_name) from persons where id = a.reviewer_person_id),
    'self_comment', a.self_comment,
    'manager_comment', case when tunjuk_pelulus then a.manager_comment end,
    'manager_rating', case when tunjuk_pelulus then a.manager_rating end,
    'final_rating', case when tunjuk_pelulus then a.final_rating end,
    'hr_note', case when tunjuk_pelulus then a.hr_note end,
    'self_submitted_at', a.self_submitted_at, 'manager_submitted_at', a.manager_submitted_at, 'finalised_at', a.finalised_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', i.id, 'title', i.title, 'description', i.description, 'target', i.target, 'weight', i.weight,
                'self_score', i.self_score, 'self_note', i.self_note,
                'manager_score', case when tunjuk_pelulus then i.manager_score end,
                'manager_note', case when tunjuk_pelulus then i.manager_note end) order by i.sort_order, i.title), '[]')
                from appraisal_items i where i.appraisal_id = a.id));
end $$;

-- KPI boleh diubah oleh pekerja (peringkat kendiri), pelulus (sebelum dihantar) atau HR (sebelum muktamad)
create or replace function appraisal_set_items(p_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; peranan text; x jsonb; i int := 0; ids uuid[] := '{}'; iid uuid;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  peranan := appraisal_role(a);
  if not ((peranan = 'self' and a.status = 'self') or (peranan = 'reviewer' and a.status in ('self','manager')) or (peranan = 'hr' and a.status <> 'final')) then
    raise exception 'KPI tidak boleh diubah pada peringkat ini';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_items, '[]'))) > 20 then raise exception 'Maksimum 20 KPI'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    continue when coalesce(trim(x->>'title'), '') = '';
    iid := nullif(x->>'id', '')::uuid;
    if iid is not null and exists (select 1 from appraisal_items where id = iid and appraisal_id = a.id) then
      update appraisal_items set title = left(trim(x->>'title'), 200), description = left(nullif(trim(x->>'description'), ''), 1000),
             target = left(nullif(trim(x->>'target'), ''), 300), weight = greatest(1, least(100, coalesce((x->>'weight')::int, 1))), sort_order = i
       where id = iid;
    else
      insert into appraisal_items(appraisal_id, title, description, target, weight, sort_order)
      values (a.id, left(trim(x->>'title'), 200), left(nullif(trim(x->>'description'), ''), 1000), left(nullif(trim(x->>'target'), ''), 300),
              greatest(1, least(100, coalesce((x->>'weight')::int, 1))), i)
      returning id into iid;
    end if;
    ids := ids || iid;
    i := i + 1;
  end loop;
  delete from appraisal_items where appraisal_id = a.id and not (id = any(ids));
end $$;

-- Pekerja: markah kendiri. p_scores = [{id, score, note}]; p_submit = true → hantar kepada pelulus
create or replace function appraisal_self_save(p_id uuid, p_scores jsonb, p_comment text, p_submit boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; x jsonb; c appraisal_cycles;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null or appraisal_role(a) <> 'self' then raise exception 'Tidak dibenarkan'; end if;
  if a.status <> 'self' then raise exception 'Penilaian kendiri telah dihantar'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  if c.status <> 'open' then raise exception 'Kitaran penilaian tidak dibuka'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_scores, '[]')) loop
    update appraisal_items set self_score = nullif(x->>'score', '')::int, self_note = left(nullif(trim(x->>'note'), ''), 1000)
     where id = (x->>'id')::uuid and appraisal_id = a.id;
  end loop;
  update appraisals set self_comment = left(nullif(trim(p_comment), ''), 2000) where id = a.id;
  if p_submit then
    if not exists (select 1 from appraisal_items where appraisal_id = a.id) then raise exception 'Tiada KPI untuk dinilai'; end if;
    if exists (select 1 from appraisal_items where appraisal_id = a.id and self_score is null) then raise exception 'Sila beri markah bagi setiap KPI'; end if;
    update appraisals set status = case when reviewer_person_id is null then 'hr' else 'manager' end, self_submitted_at = now() where id = a.id;
    if a.reviewer_person_id is not null then
      perform notify_person(a.reviewer_person_id, c.company_id,
        (select coalesce(p.preferred_name, p.full_name) from employments e join persons p on p.id = e.person_id where e.id = a.employment_id)
        || ' telah menghantar penilaian kendiri (' || c.name || '). Sila buat penilaian anda di HRBoost → Saya → Penilaian prestasi.');
    end if;
  end if;
end $$;

-- Pelulus: markah & ulasan. p_submit = true → kepada HR
create or replace function appraisal_manager_save(p_id uuid, p_scores jsonb, p_comment text, p_submit boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; x jsonb; c appraisal_cycles; purata numeric;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null or appraisal_role(a) not in ('reviewer','hr') then raise exception 'Tidak dibenarkan'; end if;
  -- HR boleh mengisi bagi pihak pelulus yang tiada / bercuti
  if a.status not in ('self','manager','hr') or (a.status = 'hr' and appraisal_role(a) <> 'hr') then raise exception 'Penilaian pelulus telah dihantar'; end if;
  if a.status = 'self' then raise exception 'Menunggu penilaian kendiri pekerja'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  for x in select * from jsonb_array_elements(coalesce(p_scores, '[]')) loop
    update appraisal_items set manager_score = nullif(x->>'score', '')::int, manager_note = left(nullif(trim(x->>'note'), ''), 1000)
     where id = (x->>'id')::uuid and appraisal_id = a.id;
  end loop;
  select round(sum(manager_score * weight)::numeric / nullif(sum(weight) filter (where manager_score is not null), 0), 2) into purata
    from appraisal_items where appraisal_id = a.id;
  update appraisals set manager_comment = left(nullif(trim(p_comment), ''), 2000), manager_rating = purata where id = a.id;
  if p_submit then
    if exists (select 1 from appraisal_items where appraisal_id = a.id and manager_score is null) then raise exception 'Sila beri markah bagi setiap KPI'; end if;
    update appraisals set status = 'hr', manager_submitted_at = now() where id = a.id;
  end if;
end $$;

-- HR: muktamadkan (markah akhir lalai = markah pelulus)
create or replace function hr_appraisal_finalise(p_id uuid, p_rating numeric default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; c appraisal_cycles; akhir numeric; pid uuid;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null or appraisal_role(a) <> 'hr' and not (appraisal_role(a) = 'reviewer' and has_role((select company_id from appraisal_cycles where id = a.cycle_id), '{hr,admin}')) then
    raise exception 'Hanya HR/Pentadbir';
  end if;
  if a.status <> 'hr' then raise exception 'Penilaian belum sedia untuk dimuktamadkan'; end if;
  akhir := coalesce(p_rating, a.manager_rating,
                    (select round(sum(self_score * weight)::numeric / nullif(sum(weight), 0), 2) from appraisal_items where appraisal_id = a.id));
  if akhir is null or akhir < 1 or akhir > 5 then raise exception 'Markah akhir mesti antara 1 dan 5'; end if;
  update appraisals set status = 'final', final_rating = round(akhir, 2), hr_note = left(nullif(trim(p_note), ''), 2000), finalised_at = now() where id = a.id;
  select * into c from appraisal_cycles where id = a.cycle_id;
  select person_id into pid from employments where id = a.employment_id;
  perform notify_person(pid, c.company_id, 'Penilaian prestasi ' || c.name || ' anda telah dimuktamadkan. Lihat keputusan di HRBoost → Saya → Penilaian prestasi.');
end $$;

-- Senarai untuk pengguna: penilaian sendiri & yang perlu dinilai
create or replace function my_appraisals(p_company uuid)
returns table(id uuid, role text, cycle_name text, period_end date, due date, status text, employee text, final_rating numeric)
language sql stable security definer set search_path = public as $$
  select a.id, 'self', c.name, c.period_end, c.self_due, a.status, null::text, case when a.status = 'final' then a.final_rating end
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id join employments e on e.id = a.employment_id
   where e.person_id = current_person_id() and c.company_id = p_company and c.status <> 'draft'
  union all
  select a.id, 'reviewer', c.name, c.period_end, c.manager_due, a.status, coalesce(p.preferred_name, p.full_name), a.manager_rating
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
   where a.reviewer_person_id = current_person_id() and c.company_id = p_company and c.status <> 'draft'
  order by 4 desc, 2, 7
$$;

do $$
declare f text;
begin
  foreach f in array array['hr_appraisal_cycle_save(uuid,jsonb,uuid)','hr_appraisal_cycle_open(uuid,uuid[])','hr_appraisal_cycle_close(uuid)',
                           'hr_appraisal_cycles(uuid)','hr_appraisal_list(uuid)','appraisal_detail(uuid)','appraisal_set_items(uuid,jsonb)',
                           'appraisal_self_save(uuid,jsonb,text,boolean)','appraisal_manager_save(uuid,jsonb,text,boolean)',
                           'hr_appraisal_finalise(uuid,numeric,text)','my_appraisals(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  execute 'revoke all on function appraisal_role(appraisals) from public';
end $$;

-- Terjemahan WhatsApp
insert into message_i18n(kind, ms, en, sort) values
  ('message', $q$^Penilaian prestasi (.+) telah dibuka\. Sila isi penilaian kendiri anda sebelum (\S+) di HRBoost → Saya → Penilaian prestasi\.$$q$,
              $q$Performance review \1 is open. Please complete your self-assessment before \2 in HRBoost → Me → Performance review.$q$, 640),
  ('message', $q$^Penilaian prestasi (.+) telah dibuka\. Sila isi penilaian kendiri anda di HRBoost → Saya → Penilaian prestasi\.$$q$,
              $q$Performance review \1 is open. Please complete your self-assessment in HRBoost → Me → Performance review.$q$, 641),
  ('message', $q$^(.+) telah menghantar penilaian kendiri \((.+)\)\. Sila buat penilaian anda di HRBoost → Saya → Penilaian prestasi\.$$q$,
              $q$\1 has submitted a self-assessment (\2). Please complete your review in HRBoost → Me → Performance review.$q$, 642),
  ('message', $q$^Penilaian prestasi (.+) anda telah dimuktamadkan\. Lihat keputusan di HRBoost → Saya → Penilaian prestasi\.$$q$,
              $q$Your performance review \1 has been finalised. See the result in HRBoost → Me → Performance review.$q$, 643)
on conflict (kind, ms) do nothing;
