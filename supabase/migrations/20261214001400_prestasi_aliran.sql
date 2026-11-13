-- =====================================================================
--  Penilaian prestasi: aliran pelulus baharu & KPI ditetapkan HR
--  - Pekerja biasa  → dinilai ketua jabatan; jika jabatan tiada ketua → pengurus yang ditetapkan
--                     dalam profil; jika tiada → HR perlu tetapkan pelulus (status menunggu).
--  - Ketua jabatan  → dinilai CEO.
--  - CEO            → tiada pelulus (terus kepada HR untuk dimuktamadkan).
--  - KPI setiap pekerja hanya boleh diubah oleh HR / Pentadbir (bukan pekerja, bukan pelulus).
--  - Muktamad: HR / Pentadbir / CEO, kecuali penilaian diri sendiri (supaya penilaian HR tidak tersekat).
-- =====================================================================

-- true = tiada pelulus mengikut reka bentuk (CEO); false + reviewer null = HR perlu menetapkan pelulus
alter table appraisals add column if not exists reviewer_skip boolean not null default false;

-- Pelulus bagi satu pekerjaan: (pelulus, langkau?)
create or replace function appraisal_reviewer_for(p_employment uuid, out reviewer uuid, out skip boolean)
language plpgsql stable security definer set search_path = public as $$
declare e employments; ketua uuid; ceo uuid;
begin
  skip := false;
  select * into e from employments where id = p_employment;
  if e.id is null then return; end if;
  -- CEO: tiada pelulus
  if exists (select 1 from user_roles r where r.company_id = e.company_id and r.person_id = e.person_id and r.role = 'ceo') then
    skip := true; return;
  end if;
  select r.person_id into ceo
    from user_roles r join employments x on x.person_id = r.person_id and x.company_id = r.company_id and x.status in ('probation','active')
   where r.company_id = e.company_id and r.role = 'ceo' and r.person_id <> e.person_id
   order by x.join_date nulls last limit 1;
  -- Ketua jabatan (mana-mana jabatan dalam syarikat) → CEO
  if exists (select 1 from departments d where d.company_id = e.company_id and d.head_person_id = e.person_id) then
    reviewer := ceo; return;
  end if;
  -- Pekerja: ketua jabatan → pengurus dalam profil → (tiada: HR tetapkan)
  select d.head_person_id into ketua from departments d where d.id = e.department_id;
  reviewer := case when ketua is not null and ketua <> e.person_id then ketua
                   when e.manager_person_id is not null and e.manager_person_id <> e.person_id then e.manager_person_id end;
end $$;

-- Buka kitaran: guna aliran pelulus baharu
create or replace function hr_appraisal_cycle_open(p_cycle uuid, p_employments uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare c appraisal_cycles; e record; aid uuid; n int := 0; x jsonb; i int; r record;
begin
  select * into c from appraisal_cycles where id = p_cycle;
  if c.id is null or not has_role(c.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if c.status = 'closed' then raise exception 'Kitaran telah ditutup'; end if;
  for e in
    select em.id, em.person_id
      from employments em
     where em.company_id = c.company_id and em.status in ('probation','active') and em.join_date <= c.period_end
       and (p_employments is null or em.id = any(p_employments))
       and not exists (select 1 from appraisals a where a.cycle_id = c.id and a.employment_id = em.id)
  loop
    r := appraisal_reviewer_for(e.id);
    insert into appraisals(cycle_id, employment_id, reviewer_person_id, reviewer_skip)
    values (c.id, e.id, r.reviewer, r.skip)
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

-- HR: tetapkan / tukar pelulus satu penilaian (cth. jabatan tanpa ketua)
create or replace function hr_appraisal_set_reviewer(p_id uuid, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; c appraisal_cycles; pekerja uuid; nama text;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  if not has_role(c.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if a.status not in ('self','manager') then raise exception 'Penilaian pelulus telah dihantar'; end if;
  select e.person_id, coalesce(p.preferred_name, p.full_name) into pekerja, nama
    from employments e join persons p on p.id = e.person_id where e.id = a.employment_id;
  if p_person is null or p_person = pekerja then raise exception 'Pelulus tidak sah'; end if;
  if not exists (select 1 from employments x where x.person_id = p_person and x.company_id = c.company_id and x.status in ('probation','active')) then
    raise exception 'Pelulus tidak sah';
  end if;
  update appraisals set reviewer_person_id = p_person, reviewer_skip = false where id = a.id;
  if a.status = 'manager' and a.reviewer_person_id is distinct from p_person then
    perform notify_person(p_person, c.company_id,
      nama || ' telah menghantar penilaian kendiri (' || c.name || '). Sila buat penilaian anda di HRBoost → Saya → Penilaian prestasi.');
  end if;
end $$;

-- KPI: HR / Pentadbir sahaja
create or replace function appraisal_set_items(p_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; x jsonb; i int := 0; ids uuid[] := '{}'; iid uuid;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  if appraisal_role(a) <> 'hr' then raise exception 'Hanya HR boleh mengubah KPI'; end if;
  if a.status = 'final' then raise exception 'KPI tidak boleh diubah pada peringkat ini'; end if;
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
  if cardinality(ids) = 0 then raise exception 'Sekurang-kurangnya satu KPI diperlukan'; end if;
  delete from appraisal_items where appraisal_id = a.id and not (id = any(ids));
end $$;

-- Kendiri dihantar: tiada pelulus & bukan CEO → kekal "menunggu pelulus" sehingga HR menetapkan pelulus
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
    update appraisals set status = case when reviewer_person_id is null and reviewer_skip then 'hr' else 'manager' end,
                          self_submitted_at = now() where id = a.id;
    if a.reviewer_person_id is not null then
      perform notify_person(a.reviewer_person_id, c.company_id,
        (select coalesce(p.preferred_name, p.full_name) from employments e join persons p on p.id = e.person_id where e.id = a.employment_id)
        || ' telah menghantar penilaian kendiri (' || c.name || '). Sila buat penilaian anda di HRBoost → Saya → Penilaian prestasi.');
    end if;
  end if;
end $$;

-- Muktamad: HR / Pentadbir / CEO, bukan penilaian sendiri
create or replace function hr_appraisal_finalise(p_id uuid, p_rating numeric default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a appraisals; c appraisal_cycles; akhir numeric; pid uuid;
begin
  select * into a from appraisals where id = p_id for update;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  select person_id into pid from employments where id = a.employment_id;
  if pid = current_person_id() then raise exception 'Anda tidak boleh memuktamadkan penilaian anda sendiri'; end if;
  if not has_role(c.company_id, '{hr,admin,ceo}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if a.status <> 'hr' then raise exception 'Penilaian belum sedia untuk dimuktamadkan'; end if;
  akhir := coalesce(p_rating, a.manager_rating,
                    (select round(sum(self_score * weight)::numeric / nullif(sum(weight), 0), 2) from appraisal_items where appraisal_id = a.id));
  if akhir is null or akhir < 1 or akhir > 5 then raise exception 'Markah akhir mesti antara 1 dan 5'; end if;
  update appraisals set status = 'final', final_rating = round(akhir, 2), hr_note = left(nullif(trim(p_note), ''), 2000), finalised_at = now() where id = a.id;
  perform notify_person(pid, c.company_id, 'Penilaian prestasi ' || c.name || ' anda telah dimuktamadkan. Lihat keputusan di HRBoost → Saya → Penilaian prestasi.');
end $$;

-- Senarai HR: tambah status "perlu pelulus"
drop function if exists hr_appraisal_list(uuid);
create function hr_appraisal_list(p_cycle uuid)
returns table(id uuid, employment_id uuid, employee_no text, name text, department text, reviewer text, status text,
              manager_rating numeric, final_rating numeric, self_submitted_at timestamptz, manager_submitted_at timestamptz,
              reviewer_skip boolean, needs_reviewer boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.employment_id, e.employee_no, coalesce(p.preferred_name, p.full_name), d.name,
         (select coalesce(r.preferred_name, r.full_name) from persons r where r.id = a.reviewer_person_id),
         a.status, a.manager_rating, a.final_rating, a.self_submitted_at, a.manager_submitted_at,
         a.reviewer_skip, (a.reviewer_person_id is null and not a.reviewer_skip and a.status in ('self','manager'))
    from appraisals a join appraisal_cycles c on c.id = a.cycle_id
    join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
    left join departments d on d.id = e.department_id
   where a.cycle_id = p_cycle and has_role(c.company_id, '{hr,ceo,admin}')
   order by d.name nulls last, coalesce(p.preferred_name, p.full_name)
$$;

-- Butiran: tambah reviewer_skip / needs_reviewer / reviewer_person_id (untuk HR)
create or replace function appraisal_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a appraisals; c appraisal_cycles; peranan text; tunjuk_pelulus boolean; boleh_muktamad boolean;
begin
  select * into a from appraisals where id = p_id;
  if a.id is null then raise exception 'Penilaian tidak dijumpai'; end if;
  peranan := appraisal_role(a);
  if peranan is null then raise exception 'Tidak dibenarkan'; end if;
  select * into c from appraisal_cycles where id = a.cycle_id;
  tunjuk_pelulus := peranan <> 'self' or a.status = 'final';
  boleh_muktamad := peranan <> 'self' and has_role(c.company_id, '{hr,admin,ceo}');
  return jsonb_build_object(
    'id', a.id, 'role', peranan, 'status', a.status, 'can_finalise', boleh_muktamad,
    'reviewer_skip', a.reviewer_skip,
    'needs_reviewer', a.reviewer_person_id is null and not a.reviewer_skip and a.status in ('self','manager'),
    'reviewer_person_id', case when peranan = 'hr' then a.reviewer_person_id end,
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

-- Data sedia ada: kira semula pelulus bagi penilaian yang belum dinilai pelulus
do $$
declare a record; r record;
begin
  for a in select x.id, x.employment_id, x.status, x.reviewer_person_id
             from appraisals x join appraisal_cycles c on c.id = x.cycle_id
            where c.status <> 'closed' and x.manager_submitted_at is null and x.status in ('self','manager','hr') loop
    r := appraisal_reviewer_for(a.employment_id);
    update appraisals set reviewer_person_id = r.reviewer, reviewer_skip = r.skip,
           -- kendiri dihantar terus ke HR kerana tiada pelulus dahulu → kini ada pelulus (cth. ketua → CEO)
           status = case when a.status = 'hr' and r.reviewer is not null then 'manager' else status end
     where id = a.id;
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['hr_appraisal_set_reviewer(uuid,uuid)','hr_appraisal_list(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
  execute 'revoke all on function appraisal_reviewer_for(uuid) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function appraisal_reviewer_for(uuid) from anon, authenticated';
  end if;
end $$;
