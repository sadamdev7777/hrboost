-- =====================================================================
--  HR lebih mudah II (bahagian 2)
--  5. Peti soalan HR (AI menjawab dahulu, kemudian HR)
--  6. Pendahuluan gaji (potongan automatik bulan berikutnya)
--  7. Permohonan susunan kerja fleksibel (Akta Kerja Bahagian XIIC: jawapan bertulis dalam 60 hari)
--  8. Penilaian akhir tempoh percubaan oleh ketua jabatan
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5. Peti soalan HR
-- ---------------------------------------------------------------------
create table if not exists hr_questions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  employment_id  uuid not null references employments(id) on delete cascade,
  question       text not null check (length(question) between 3 and 2000),
  ai_answer      text,
  status         text not null default 'open' check (status in ('open','answered','ai_resolved')),
  answer         text,
  answered_by    uuid references persons(id),
  answered_at    timestamptz,
  created_at     timestamptz not null default now()
);
alter table hr_questions enable row level security;
create policy read_q on hr_questions for select using (
  has_role(company_id, '{hr,admin}') or exists (select 1 from employments e where e.id = employment_id and e.person_id = current_person_id()));

-- p_to_hr = false → jawapan AI sudah memadai (direkod untuk statistik); true → dihantar kepada HR
create or replace function ask_hr(p_employment uuid, p_question text, p_ai_answer text default null, p_to_hr boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare e employments; nid uuid; nama text; p record;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id is distinct from current_person_id() then raise exception 'Bukan rekod anda'; end if;
  if length(trim(coalesce(p_question, ''))) < 3 then raise exception 'Sila taip soalan anda'; end if;
  if p_to_hr and (select count(*) from hr_questions where employment_id = e.id and status = 'open') >= 5 then
    raise exception 'Anda mempunyai 5 soalan yang belum dijawab. Sila tunggu jawapan HR.';
  end if;
  insert into hr_questions(company_id, employment_id, question, ai_answer, status)
  values (e.company_id, e.id, trim(p_question), nullif(trim(coalesce(p_ai_answer, '')), ''), case when p_to_hr then 'open' else 'ai_resolved' end)
  returning id into nid;
  if p_to_hr then
    select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
    for p in select distinct ur.person_id from user_roles ur
               join employments x on x.person_id = ur.person_id and x.company_id = e.company_id and x.status in ('probation','active')
              where ur.company_id = e.company_id and ur.role = 'hr' loop
      perform notify_person(p.person_id, e.company_id, 'Soalan daripada ' || nama || ': "' || left(trim(p_question), 300) || '". Jawab di HRBoost → Soalan HR.');
    end loop;
  end if;
  return nid;
end $$;

create or replace function answer_hr_question(p_id uuid, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare q hr_questions; e employments;
begin
  select * into q from hr_questions where id = p_id;
  if q.id is null or not has_role(q.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if length(trim(coalesce(p_answer, ''))) < 2 then raise exception 'Sila taip jawapan'; end if;
  update hr_questions set status = 'answered', answer = trim(p_answer), answered_by = current_person_id(), answered_at = now() where id = q.id;
  select * into e from employments where id = q.employment_id;
  perform notify_person(e.person_id, q.company_id, 'Jawapan HR kepada soalan anda: "' || left(q.question, 120) || E'"\n\n' || left(trim(p_answer), 900));
end $$;

create or replace function hr_question_list(p_company uuid, p_mine boolean default false)
returns table(id uuid, employment_id uuid, name text, question text, ai_answer text, status text, answer text, answered_by_name text,
              answered_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not p_mine and not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select q.id, q.employment_id, coalesce(p.preferred_name, p.full_name), q.question, q.ai_answer, q.status, q.answer,
         coalesce(a.preferred_name, a.full_name), q.answered_at, q.created_at
    from hr_questions q join employments e on e.id = q.employment_id join persons p on p.id = e.person_id
    left join persons a on a.id = q.answered_by
   where q.company_id = p_company and (not p_mine or e.person_id = current_person_id()) and (p_mine or q.status <> 'ai_resolved')
   order by (q.status = 'open') desc, q.created_at desc limit 200;
end $$;

-- Statistik 30 hari: soalan, diselesaikan AI, purata jam untuk HR menjawab
create or replace function hr_question_stats(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return (select jsonb_build_object(
      'total', count(*), 'ai_resolved', count(*) filter (where status = 'ai_resolved'), 'open', count(*) filter (where status = 'open'),
      'avg_hours', round(extract(epoch from avg(answered_at - created_at) filter (where status = 'answered')) / 3600.0, 1))
    from hr_questions where company_id = p_company and created_at >= now() - interval '30 days');
end $$;

-- ---------------------------------------------------------------------
-- 6. Pendahuluan gaji
-- ---------------------------------------------------------------------
insert into platform_settings(key, value) values ('salary_advance', '{"max_ratio": 0.5}') on conflict (key) do nothing;

create table if not exists salary_advances (
  id                   uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references employments(id) on delete cascade,
  amount               numeric(12,2) not null check (amount > 0),
  reason               text not null,
  status               request_status not null default 'pending',
  approval_request_id  uuid references approval_requests(id),
  deduct_year          int,
  deduct_month         int,
  disbursed_at         timestamptz,
  deducted_via_payroll_run uuid references payroll_runs(id) on delete set null,
  created_at           timestamptz not null default now()
);
alter table salary_advances enable row level security;
create policy read_adv on salary_advances for select using (can_view_employment(employment_id) or has_role(employment_company(employment_id), '{hr,finance,ceo,admin}'));

insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable)
select id, 'ADVANCE', 'Potongan Pendahuluan Gaji', 'deduction', false, false, false from companies
on conflict do nothing;
select ensure_workflow(id, 'salary_advance') from companies;

create or replace function salary_advance_limit(p_employment uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce(sum(ec.amount), 0) * coalesce((select (value->>'max_ratio')::numeric from platform_settings where key = 'salary_advance'), 0.5), 2)
    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
   where ec.employment_id = p_employment and pc.code = 'BASIC'
     and ec.effective_from <= current_date and (ec.effective_to is null or ec.effective_to >= current_date)
$$;

create or replace function submit_salary_advance(p_employment uuid, p_amount numeric, p_reason text,
                                                 p_via action_channel default 'web', p_on_behalf uuid default null)
returns salary_advances language plpgsql security definer set search_path = public as $$
declare actor uuid; e employments; a salary_advances; rid uuid; had numeric;
begin
  actor := resolve_actor(p_on_behalf);
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id <> actor then raise exception 'Bukan rekod anda'; end if;
  if e.status <> 'active' then raise exception 'Pendahuluan gaji hanya untuk pekerja yang telah disahkan jawatan'; end if;
  had := salary_advance_limit(e.id);
  if had <= 0 then raise exception 'Gaji pokok anda belum ditetapkan. Hubungi HR.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Jumlah tidak sah'; end if;
  if p_amount > had then raise exception 'Jumlah melebihi had pendahuluan (RM%)', to_char(had, 'FM999,999,990.00'); end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab'; end if;
  if exists (select 1 from salary_advances x where x.employment_id = e.id and (x.status = 'pending' or (x.status = 'approved' and x.deducted_via_payroll_run is null))) then
    raise exception 'Anda masih mempunyai pendahuluan gaji yang belum selesai';
  end if;
  perform ensure_workflow(e.company_id, 'salary_advance');
  insert into salary_advances(employment_id, amount, reason) values (e.id, round(p_amount, 2), trim(p_reason)) returning * into a;
  rid := approval_create('salary_advance', a.id, e.id,
           'Pendahuluan gaji RM' || to_char(a.amount, 'FM999,999,990.00'),
           jsonb_build_object('amount', a.amount, 'reason', a.reason, 'limit', had), false, p_via);
  update salary_advances set approval_request_id = rid where id = a.id returning * into a;
  return a;
end $$;

create or replace function my_salary_advances(p_employment uuid)
returns table(id uuid, amount numeric, reason text, status request_status, deduct_year int, deduct_month int, deducted boolean, approval_request_id uuid, created_at timestamptz, max_amount numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.amount, a.reason, a.status, a.deduct_year, a.deduct_month, a.deducted_via_payroll_run is not null, a.approval_request_id, a.created_at,
         salary_advance_limit(p_employment)
    from employments e left join salary_advances a on a.employment_id = e.id
   where e.id = p_employment and e.person_id = current_person_id()
   order by a.created_at desc nulls last limit 20
$$;

create or replace function finance_mark_advance_paid(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a salary_advances; e employments;
begin
  select * into a from salary_advances where id = p_id;
  select * into e from employments where id = a.employment_id;
  if a.id is null or not has_role(e.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR / Kewangan'; end if;
  if a.status <> 'approved' then raise exception 'Pendahuluan belum diluluskan'; end if;
  update salary_advances set disbursed_at = coalesce(disbursed_at, now()) where id = a.id;
  perform notify_person(e.person_id, e.company_id, 'Pendahuluan gaji RM' || to_char(a.amount, 'FM999,999,990.00') || ' telah dibayar. Ia akan ditolak daripada gaji ' ||
    (array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'])[a.deduct_month] || ' ' || a.deduct_year || '.');
end $$;

create or replace function hr_salary_advances(p_company uuid)
returns table(id uuid, employment_id uuid, name text, amount numeric, reason text, status request_status, deduct_year int, deduct_month int,
              disbursed_at timestamptz, deducted boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select a.id, a.employment_id, coalesce(p.preferred_name, p.full_name), a.amount, a.reason, a.status, a.deduct_year, a.deduct_month,
         a.disbursed_at, a.deducted_via_payroll_run is not null, a.created_at
    from salary_advances a join employments e on e.id = a.employment_id join persons p on p.id = e.person_id
   where e.company_id = p_company and a.status in ('pending','approved')
   order by a.created_at desc limit 100;
end $$;

-- Hasil kelulusan (lanjutan pencetus): OT + pendahuluan gaji
create or replace function approval_extra_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare o overtime_requests; asas numeric; kadar numeric; seterusnya date;
begin
  if new.status = old.status then return new; end if;
  if new.request_type = 'overtime' then
    update overtime_requests set status = new.status where id = new.reference_id returning * into o;
    if new.status = 'approved' and o.id is not null then
      select coalesce(sum(ec.amount), 0) into asas from employment_compensation ec join pay_components pc on pc.id = ec.component_id
       where ec.employment_id = o.employment_id and pc.code = 'BASIC'
         and ec.effective_from <= o.work_date and (ec.effective_to is null or ec.effective_to >= o.work_date);
      kadar := case o.day_type when 'rest' then 2.0 when 'holiday' then 3.0 else 1.5 end;
      update overtime_requests set amount = round(asas / 26 / 8 * kadar * o.hours, 2), monthly_basic = asas where id = o.id;
    end if;
  elsif new.request_type = 'salary_advance' then
    seterusnya := (date_trunc('month', (now() at time zone 'Asia/Kuala_Lumpur')::date) + interval '1 month')::date;
    update salary_advances set status = new.status,
           deduct_year = case when new.status = 'approved' then extract(year from seterusnya)::int end,
           deduct_month = case when new.status = 'approved' then extract(month from seterusnya)::int end
     where id = new.reference_id;
  end if;
  return new;
end $$;

-- Segerak gaji: OT + potongan pendahuluan
create or replace function payroll_sync_extras(p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; d0 date; d1 date; x record;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null then return; end if;
  d0 := make_date(r.period_year, r.period_month, 1); d1 := (d0 + interval '1 month - 1 day')::date;
  insert into pay_components(company_id, code, name, kind, taxable, epf_applicable, socso_applicable) values
    (r.company_id, 'OT_LULUS', 'Kerja Lebih Masa (diluluskan)', 'earning', true, false, true),
    (r.company_id, 'ADVANCE', 'Potongan Pendahuluan Gaji', 'deduction', false, false, false)
  on conflict do nothing;
  -- Kerja lebih masa
  update overtime_requests set paid_via_payroll_run = null where paid_via_payroll_run = r.id;
  update overtime_requests o set paid_via_payroll_run = r.id
    from employments e
   where e.id = o.employment_id and e.company_id = r.company_id and o.status = 'approved' and o.paid_via_payroll_run is null
     and o.work_date <= d1 and o.amount > 0;
  delete from payroll_adjustments where payroll_run_id = r.id and component_code in ('OT_LULUS','ADVANCE');
  for x in select employment_id, sum(amount) amt, sum(hours) jam from overtime_requests where paid_via_payroll_run = r.id group by employment_id loop
    insert into payroll_adjustments(payroll_run_id, employment_id, component_code, amount, note)
    values (r.id, x.employment_id, 'OT_LULUS', x.amt, fmt_num(x.jam) || ' jam kerja lebih masa diluluskan');
  end loop;
  -- Pendahuluan gaji: ditolak pada bulan yang ditetapkan (atau bulan pertama selepasnya jika tertinggal)
  update salary_advances set deducted_via_payroll_run = null where deducted_via_payroll_run = r.id;
  update salary_advances a set deducted_via_payroll_run = r.id
    from employments e
   where e.id = a.employment_id and e.company_id = r.company_id and a.status = 'approved' and a.deducted_via_payroll_run is null
     and make_date(a.deduct_year, a.deduct_month, 1) <= d0;
  for x in select employment_id, sum(amount) amt from salary_advances where deducted_via_payroll_run = r.id group by employment_id loop
    insert into payroll_adjustments(payroll_run_id, employment_id, component_code, amount, note)
    values (r.id, x.employment_id, 'ADVANCE', x.amt, 'Pendahuluan gaji');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Susunan kerja fleksibel (Akta Kerja 1955 Bahagian XIIC)
-- ---------------------------------------------------------------------
create table if not exists flexible_work_requests (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  employment_id  uuid not null references employments(id) on delete cascade,
  change_types   text[] not null check (change_types <@ array['hours','days','place'] and cardinality(change_types) > 0),
  details        text not null check (length(details) between 5 and 2000),
  start_date     date not null,
  end_date       date,
  status         text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decision_note  text,
  decided_by     uuid references persons(id),
  decided_at     timestamptz,
  due_date       date not null,               -- 60 hari selepas permohonan diterima
  created_at     timestamptz not null default now()
);
alter table flexible_work_requests enable row level security;
create policy read_fwa on flexible_work_requests for select using (
  has_role(company_id, '{hr,admin}') or can_view_employment(employment_id));

create or replace function submit_flexible_work(p_employment uuid, p_types text[], p_details text, p_start date, p_end date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare e employments; nid uuid; nama text; p record;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id is distinct from current_person_id() then raise exception 'Bukan rekod anda'; end if;
  if e.status not in ('probation','active') then raise exception 'Pekerjaan ini tidak aktif'; end if;
  if p_types is null or cardinality(p_types) = 0 or not (p_types <@ array['hours','days','place']) then raise exception 'Pilih sekurang-kurangnya satu perubahan'; end if;
  if length(trim(coalesce(p_details, ''))) < 5 then raise exception 'Sila terangkan susunan kerja yang dimohon'; end if;
  if p_start is null or p_start < current_date then raise exception 'Tarikh mula tidak sah'; end if;
  if p_end is not null and p_end < p_start then raise exception 'Tarikh tamat sebelum tarikh mula'; end if;
  if exists (select 1 from flexible_work_requests x where x.employment_id = e.id and x.status = 'pending') then
    raise exception 'Anda mempunyai permohonan yang masih belum diputuskan';
  end if;
  insert into flexible_work_requests(company_id, employment_id, change_types, details, start_date, end_date, due_date)
  values (e.company_id, e.id, p_types, trim(p_details), p_start, p_end, current_date + 60) returning id into nid;
  select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
  for p in select distinct ur.person_id from user_roles ur
             join employments x on x.person_id = ur.person_id and x.company_id = e.company_id and x.status in ('probation','active')
            where ur.company_id = e.company_id and ur.role = 'hr' loop
    perform notify_person(p.person_id, e.company_id, nama || ' memohon susunan kerja fleksibel. Akta Kerja mewajibkan jawapan bertulis sebelum ' ||
      to_char(current_date + 60, 'DD/MM/YYYY') || '. Semak di HRBoost → Kerja fleksibel.');
  end loop;
  return nid;
end $$;

create or replace function decide_flexible_work(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare f flexible_work_requests; e employments;
begin
  select * into f from flexible_work_requests where id = p_id;
  if f.id is null or not has_role(f.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if f.status <> 'pending' then raise exception 'Permohonan ini telah diputuskan'; end if;
  -- Akta Kerja s.60P(4): jika ditolak, majikan mesti menyatakan sebab
  if not p_approve and length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Sila nyatakan sebab penolakan (wajib di bawah Akta Kerja)'; end if;
  update flexible_work_requests set status = case when p_approve then 'approved' else 'rejected' end, decision_note = nullif(trim(coalesce(p_note, '')), ''),
         decided_by = current_person_id(), decided_at = now() where id = f.id;
  select * into e from employments where id = f.employment_id;
  perform notify_person(e.person_id, f.company_id, 'Permohonan susunan kerja fleksibel anda ' || case when p_approve then 'DILULUSKAN' else 'TIDAK DILULUSKAN' end ||
    coalesce('. ' || nullif(trim(coalesce(p_note, '')), ''), '') || '. Butiran di HRBoost → Mohon → Kerja fleksibel.');
end $$;

create or replace function withdraw_flexible_work(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update flexible_work_requests f set status = 'withdrawn'
   where f.id = p_id and f.status = 'pending' and exists (select 1 from employments e where e.id = f.employment_id and e.person_id = current_person_id());
  if not found then raise exception 'Permohonan tidak dapat ditarik balik'; end if;
end $$;

create or replace function flexible_work_list(p_company uuid, p_mine boolean default false)
returns table(id uuid, employment_id uuid, name text, department text, change_types text[], details text, start_date date, end_date date,
              status text, decision_note text, decided_at timestamptz, due_date date, days_left int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not p_mine and not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select f.id, f.employment_id, coalesce(p.preferred_name, p.full_name), d.name, f.change_types, f.details, f.start_date, f.end_date,
         f.status, f.decision_note, f.decided_at, f.due_date, (f.due_date - current_date)::int, f.created_at
    from flexible_work_requests f join employments e on e.id = f.employment_id join persons p on p.id = e.person_id
    left join departments d on d.id = e.department_id
   where f.company_id = p_company and (not p_mine or e.person_id = current_person_id())
   order by (f.status = 'pending') desc, f.due_date, f.created_at desc limit 200;
end $$;

-- ---------------------------------------------------------------------
-- 8. Penilaian akhir tempoh percubaan
-- ---------------------------------------------------------------------
create table if not exists probation_reviews (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  employment_id    uuid not null references employments(id) on delete cascade,
  reviewer_id      uuid not null references persons(id),
  ratings          jsonb not null,             -- {"kualiti":1-5,"kehadiran":..,"sikap":..,"kerjasama":..}
  recommendation   text not null check (recommendation in ('confirm','extend','terminate')),
  extend_months    int check (extend_months between 1 and 6),
  comments         text,
  submitted_at     timestamptz not null default now(),
  hr_decision      text check (hr_decision in ('confirmed','extended','terminated')),
  decided_by       uuid references persons(id),
  decided_at       timestamptz,
  unique (employment_id, submitted_at)
);
alter table probation_reviews enable row level security;
create policy read_pr on probation_reviews for select using (has_role(company_id, '{hr,admin}') or reviewer_id = current_person_id());

-- Pekerja percubaan dalam jabatan saya yang tamat dalam 30 hari dan belum dinilai
create or replace function my_probation_reviews_due(p_company uuid)
returns table(employment_id uuid, name text, probation_end date, days_left int)
language sql stable security definer set search_path = public as $$
  select e.id, coalesce(p.preferred_name, p.full_name), e.probation_end_date, (e.probation_end_date - current_date)::int
    from employments e join persons p on p.id = e.person_id left join departments d on d.id = e.department_id
   where e.company_id = p_company and e.status = 'probation' and e.probation_end_date <= current_date + 30
     and (d.head_person_id = current_person_id() or e.manager_person_id = current_person_id()) and e.person_id <> current_person_id()
     and not exists (select 1 from probation_reviews r where r.employment_id = e.id and r.hr_decision is null)
     and not exists (select 1 from probation_reviews r where r.employment_id = e.id and r.submitted_at > coalesce(
            (select max(x.decided_at) from probation_reviews x where x.employment_id = e.id and x.hr_decision = 'extended'), '-infinity'))
   order by e.probation_end_date
$$;

create or replace function submit_probation_review(p_employment uuid, p_ratings jsonb, p_recommendation text, p_extend_months int, p_comments text) returns uuid
language plpgsql security definer set search_path = public as $$
declare e employments; nid uuid; k text; v int; nama text; p record;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.status <> 'probation' then raise exception 'Pekerja ini tidak dalam tempoh percubaan'; end if;
  if not coalesce(has_role(e.company_id, '{hr,admin}') or exists (
      select 1 from departments d where d.id = e.department_id and d.head_person_id = current_person_id())
      or e.manager_person_id = current_person_id(), false) then
    raise exception 'Hanya ketua jabatan pekerja ini';
  end if;
  foreach k in array array['kualiti','kehadiran','sikap','kerjasama'] loop
    v := (p_ratings->>k)::int;
    if v is null or v < 1 or v > 5 then raise exception 'Sila beri penilaian 1–5 bagi setiap aspek'; end if;
  end loop;
  if p_recommendation not in ('confirm','extend','terminate') then raise exception 'Cadangan tidak sah'; end if;
  if p_recommendation = 'extend' and (p_extend_months is null or p_extend_months not between 1 and 6) then raise exception 'Pilih tempoh lanjutan 1–6 bulan'; end if;
  if p_recommendation <> 'confirm' and length(trim(coalesce(p_comments, ''))) < 5 then raise exception 'Sila nyatakan sebab cadangan anda'; end if;
  insert into probation_reviews(company_id, employment_id, reviewer_id, ratings, recommendation, extend_months, comments)
  values (e.company_id, e.id, current_person_id(), p_ratings, p_recommendation, case when p_recommendation = 'extend' then p_extend_months end,
          nullif(trim(coalesce(p_comments, '')), '')) returning id into nid;
  select coalesce(preferred_name, full_name) into nama from persons where id = e.person_id;
  for p in select distinct ur.person_id from user_roles ur
             join employments x on x.person_id = ur.person_id and x.company_id = e.company_id and x.status in ('probation','active')
            where ur.company_id = e.company_id and ur.role = 'hr' and ur.person_id <> current_person_id() loop
    perform notify_person(p.person_id, e.company_id, 'Penilaian percubaan ' || nama || ' telah dihantar oleh ketua jabatan: cadangan ' ||
      case p_recommendation when 'confirm' then 'SAHKAN JAWATAN' when 'extend' then 'LANJUT ' || p_extend_months || ' BULAN' else 'TAMATKAN' end ||
      '. Putuskan di HRBoost → Profil Pekerja.');
  end loop;
  return nid;
end $$;

create or replace function probation_review_latest(p_employment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return (select to_jsonb(x) from (
    select r.id, r.ratings, r.recommendation, r.extend_months, r.comments, r.submitted_at, r.hr_decision, r.decided_at,
           coalesce(p.preferred_name, p.full_name) reviewer
      from probation_reviews r join persons p on p.id = r.reviewer_id
     where r.employment_id = p_employment order by r.submitted_at desc limit 1) x);
end $$;

-- Keputusan HR: sahkan (melalui hr_update_employment), lanjut, atau tandakan untuk penamatan
create or replace function decide_probation(p_employment uuid, p_decision text, p_months int default null) returns void
language plpgsql security definer set search_path = public as $$
declare e employments; r probation_reviews; baru date;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR / Pentadbir'; end if;
  if e.status <> 'probation' then raise exception 'Pekerja ini tidak dalam tempoh percubaan'; end if;
  select * into r from probation_reviews where employment_id = e.id order by submitted_at desc limit 1;
  if p_decision = 'confirmed' then
    perform hr_update_employment(e.id, '{"confirm": true}'::jsonb, 'web');
  elsif p_decision = 'extended' then
    if p_months is null or p_months not between 1 and 6 then raise exception 'Pilih tempoh lanjutan 1–6 bulan'; end if;
    baru := (coalesce(e.probation_end_date, current_date) + make_interval(months => p_months))::date;
    update employments set probation_end_date = baru where id = e.id;
    perform notify_person(e.person_id, e.company_id, 'Tempoh percubaan anda dilanjutkan sehingga ' || to_char(baru, 'DD/MM/YYYY') || '. Sila berbincang dengan ketua jabatan anda.');
  elsif p_decision <> 'terminated' then
    raise exception 'Keputusan tidak sah';
  end if;
  if r.id is not null and r.hr_decision is null then
    update probation_reviews set hr_decision = p_decision, decided_by = current_person_id(), decided_at = now() where id = r.id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Kebenaran
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['ask_hr(uuid, text, text, boolean)', 'answer_hr_question(uuid, text)', 'hr_question_list(uuid, boolean)', 'hr_question_stats(uuid)',
    'salary_advance_limit(uuid)', 'submit_salary_advance(uuid, numeric, text, action_channel, uuid)', 'my_salary_advances(uuid)',
    'finance_mark_advance_paid(uuid)', 'hr_salary_advances(uuid)', 'approval_extra_outcome()', 'payroll_sync_extras(uuid)',
    'submit_flexible_work(uuid, text[], text, date, date)', 'decide_flexible_work(uuid, boolean, text)', 'withdraw_flexible_work(uuid)',
    'flexible_work_list(uuid, boolean)', 'my_probation_reviews_due(uuid)', 'submit_probation_review(uuid, jsonb, text, int, text)',
    'probation_review_latest(uuid)', 'decide_probation(uuid, text, int)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f in ('approval_extra_outcome()', 'payroll_sync_extras(uuid)', 'salary_advance_limit(uuid)') then
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;
