-- =====================================================================
--  Gaji lengkap — Fasa 2 & 3 (skema):
--   • Katalog item gaji: kategori, bendera PCB/KWSP/PERKESO/SIP/HRDF, medan Borang EA, manfaat berupa barangan (BIK)
--   • Kitaran tambahan sebulan (bonus/insentif): payroll_runs.cycle_no & kind
--   • Pelepasan slip (tarikh / tarik balik), buka semula gaji (dengan sebab, direkodkan), no. resit PCB
--   • Peta akaun GL untuk jurnal CSV
--   • Tunggakan gaji: baris slip merujuk bulan asal
-- =====================================================================

-- 1. Katalog item gaji ----------------------------------------------------------------------
alter table pay_components drop constraint if exists pay_components_kind_check;
alter table pay_components add constraint pay_components_kind_check check (kind in ('earning','deduction','benefit'));
alter table payslip_lines drop constraint if exists payslip_lines_kind_check;
alter table payslip_lines add constraint payslip_lines_kind_check check (kind in ('earning','deduction','employer','benefit'));
alter table pay_components
  add column if not exists category        text,
  add column if not exists eis_applicable  boolean,
  add column if not exists hrdf_applicable boolean,
  add column if not exists ea_field        text check (ea_field in ('B1a','B1b','B1c','B2','B3','B4','B6')),
  add column if not exists active          boolean not null default true,
  add column if not exists is_system       boolean not null default false,
  add column if not exists sort_order      int not null default 100;
alter table payslip_lines add column if not exists ref_month date;   -- tunggakan: bulan asal

update pay_components set eis_applicable = coalesce(eis_applicable, socso_applicable),
                          hrdf_applicable = coalesce(hrdf_applicable, epf_applicable),
                          is_system = code in ('BASIC','CLAIM','UNPAID','OT_LULUS','ADVANCE','COMMISSION','OT'),
                          category = coalesce(category, case
                            when code = 'BASIC' then 'remuneration'
                            when code in ('COMMISSION','BONUS','OT','OT_LULUS','INCENTIVE','ARREARS','LEAVE_PAY','DIRECTOR_FEE','SEVERANCE') then 'remuneration'
                            when code = 'CLAIM' then 'reimbursement'
                            when kind = 'deduction' then 'deduction'
                            else 'allowance' end),
                          ea_field = coalesce(ea_field, case
                            when code = 'CLAIM' or kind = 'deduction' then null
                            when code in ('COMMISSION','BONUS','INCENTIVE','DIRECTOR_FEE') then 'B1b'
                            when code = 'ARREARS' then 'B2'
                            when code = 'SEVERANCE' then 'B6'
                            when kind = 'benefit' then 'B3'
                            when code in ('BASIC','OT','OT_LULUS','LEAVE_PAY') then 'B1a'
                            else 'B1c' end);
alter table pay_components alter column eis_applicable set default true, alter column hrdf_applicable set default true;


-- Item katalog tidak menjadi lajur jadual Gaji Pekerja sehingga digunakan (elak lajur kosong)
alter table pay_components add column if not exists in_table boolean not null default true;
update pay_components set in_table = false
 where code in ('BONUS','INCENTIVE','ARREARS','LEAVE_PAY','DIRECTOR_FEE','SEVERANCE','MEAL','HOUSING','PARKING','SHIFT','TRAVEL_DUTY','OTHER_ALLOW','GIFT','BIK_CAR','BIK_OTHER','BIK_HOUSE','LOAN','PTPTN','OTHER_DED')
   and not exists (select 1 from employment_compensation ec where ec.component_id = pay_components.id);

-- Nilai lalai bendera & medan EA bagi item baharu (termasuk yang dicipta oleh fungsi lama)
create or replace function trg_pay_component_defaults() returns trigger
language plpgsql as $$
begin
  new.eis_applicable := coalesce(new.eis_applicable, new.socso_applicable);
  new.hrdf_applicable := coalesce(new.hrdf_applicable, new.epf_applicable);
  new.category := coalesce(new.category, case when new.code = 'CLAIM' then 'reimbursement' when new.kind = 'deduction' then 'deduction'
                                              when new.kind = 'benefit' then 'bik'
                                              when new.code in ('BASIC','COMMISSION','BONUS','OT','OT_LULUS','INCENTIVE','ARREARS') then 'remuneration' else 'allowance' end);
  new.ea_field := coalesce(new.ea_field, case when new.code = 'CLAIM' or new.kind = 'deduction' then null
                                              when new.code in ('COMMISSION','BONUS','INCENTIVE','DIRECTOR_FEE') then 'B1b'
                                              when new.code = 'ARREARS' then 'B2' when new.kind = 'benefit' then 'B3'
                                              when new.code in ('BASIC','OT','OT_LULUS','LEAVE_PAY') then 'B1a' else 'B1c' end);
  return new;
end $$;
drop trigger if exists pay_component_defaults on pay_components;
create trigger pay_component_defaults before insert on pay_components for each row execute function trg_pay_component_defaults();

-- Katalog lalai (ditambah kepada setiap syarikat; HR boleh ubah bendera atau nyahaktif)
create or replace function seed_pay_catalog(p_company uuid) returns void
language sql security definer set search_path = public as $$
  insert into pay_components(company_id, code, name, kind, category, taxable, epf_applicable, socso_applicable, eis_applicable, hrdf_applicable, ea_field, is_system, sort_order, in_table)
  select p_company, v.code, v.name, v.kind, v.cat, v.tx, v.epf, v.so, v.so, v.epf, v.ea, v.sys, v.ord, false from (values
    ('BONUS',        'Bonus',                                  'earning',   'remuneration', true,  true,  false, 'B1b', false, 20),
    ('INCENTIVE',    'Insentif',                               'earning',   'remuneration', true,  true,  true,  'B1b', false, 21),
    ('ARREARS',      'Tunggakan gaji',                         'earning',   'remuneration', true,  true,  true,  'B2',  true,  22),
    ('LEAVE_PAY',    'Bayaran gantian cuti',                   'earning',   'remuneration', true,  false, false, 'B1a', false, 23),
    ('DIRECTOR_FEE', 'Fi pengarah',                            'earning',   'remuneration', true,  false, false, 'B1b', false, 24),
    ('SEVERANCE',    'Pampasan kehilangan pekerjaan',          'earning',   'remuneration', true,  false, false, 'B6',  false, 25),
    ('MEAL',         'Elaun makan',                            'earning',   'allowance',    true,  true,  true,  'B1c', false, 30),
    ('TRANSPORT',    'Elaun pengangkutan',                     'earning',   'allowance',    true,  true,  true,  'B1c', false, 31),
    ('PHONE',        'Elaun telefon',                          'earning',   'allowance',    true,  true,  true,  'B1c', false, 32),
    ('HOUSING',      'Elaun perumahan',                        'earning',   'allowance',    true,  true,  true,  'B1c', false, 33),
    ('PARKING',      'Elaun letak kereta',                     'earning',   'allowance',    false, true,  true,  'B1c', false, 34),
    ('SHIFT',        'Elaun syif',                             'earning',   'allowance',    true,  true,  true,  'B1c', false, 35),
    ('ATTENDANCE',   'Elaun kehadiran',                        'earning',   'allowance',    true,  true,  true,  'B1c', false, 36),
    ('TRAVEL_DUTY',  'Elaun perjalanan (tugas rasmi)',         'earning',   'allowance',    false, false, false, 'B1c', false, 37),
    ('OTHER_ALLOW',  'Elaun lain',                             'earning',   'allowance',    true,  true,  true,  'B1c', false, 38),
    ('GIFT',         'Hadiah / baucar (tidak bercukai)',       'earning',   'perquisite',   false, false, false, 'B1c', false, 40),
    ('BIK_CAR',      'Manfaat kereta (BIK)',                   'benefit',   'bik',          true,  false, false, 'B3',  false, 50),
    ('BIK_OTHER',    'Manfaat berupa barangan lain (BIK)',     'benefit',   'bik',          true,  false, false, 'B3',  false, 51),
    ('BIK_HOUSE',    'Tempat kediaman disediakan (VOLA)',      'benefit',   'bik',          true,  false, false, 'B4',  false, 52),
    ('LOAN',         'Bayaran balik pinjaman',                 'deduction', 'deduction',    false, false, false, null,  false, 60),
    ('PTPTN',        'Bayaran balik PTPTN',                    'deduction', 'deduction',    false, false, false, null,  false, 61),
    ('OTHER_DED',    'Potongan lain',                          'deduction', 'deduction',    false, false, false, null,  false, 62)
  ) v(code, name, kind, cat, tx, epf, so, ea, sys, ord)
  on conflict (company_id, code) do nothing
$$;
select seed_pay_catalog(id) from companies;

-- Syarikat baharu turut mendapat katalog
create or replace function trg_company_pay_catalog() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_pay_catalog(new.id);
  return new;
end $$;
drop trigger if exists company_pay_catalog on companies;
create trigger company_pay_catalog after insert on companies for each row execute function trg_company_pay_catalog();

-- HR mencipta / mengubah item gaji (item sistem: nama & bendera sahaja)
create or replace function hr_save_pay_component(p_company uuid, p_code text, p_data jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare kod text := upper(regexp_replace(coalesce(nullif(p_code, ''), p_data->>'name'), '[^A-Za-z0-9]+', '_', 'g'));
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if coalesce(trim(p_data->>'name'), '') = '' then raise exception 'Sila isi nama item'; end if;
  kod := left(trim(both '_' from kod), 30);
  insert into pay_components(company_id, code, name, kind, category, taxable, epf_applicable, socso_applicable, eis_applicable, hrdf_applicable, ea_field, active, account_ref, in_table)
  values (p_company, kod, trim(p_data->>'name'), coalesce(p_data->>'kind', 'earning'), p_data->>'category',
          coalesce((p_data->>'taxable')::boolean, true), coalesce((p_data->>'epf')::boolean, true), coalesce((p_data->>'socso')::boolean, true),
          coalesce((p_data->>'eis')::boolean, true), coalesce((p_data->>'hrdf')::boolean, true), nullif(p_data->>'ea_field', ''),
          coalesce((p_data->>'active')::boolean, true), nullif(p_data->>'account_ref', ''), coalesce((p_data->>'in_table')::boolean, p_data->>'kind' is distinct from 'benefit'))
  on conflict (company_id, code) do update set
    name = excluded.name, category = excluded.category,
    kind = case when pay_components.is_system then pay_components.kind else excluded.kind end,
    taxable = excluded.taxable, epf_applicable = excluded.epf_applicable, socso_applicable = excluded.socso_applicable,
    eis_applicable = excluded.eis_applicable, hrdf_applicable = excluded.hrdf_applicable, ea_field = excluded.ea_field,
    active = case when pay_components.is_system then true else excluded.active end, account_ref = excluded.account_ref,
    in_table = case when p_data ? 'in_table' then excluded.in_table else pay_components.in_table end;
  return kod;
end $$;

-- 2. Kitaran, pelepasan slip, buka semula -------------------------------------------------------
alter table payroll_runs
  add column if not exists cycle_no            int not null default 1 check (cycle_no between 1 and 9),
  add column if not exists kind                text not null default 'regular' check (kind in ('regular','additional')),
  add column if not exists label               text,
  add column if not exists payslip_release_at  timestamptz,
  add column if not exists pcb_receipt_no      text;
alter table payroll_runs drop constraint if exists payroll_runs_company_id_period_year_period_month_key;
alter table payroll_runs drop constraint if exists payroll_runs_company_cycle_key;
alter table payroll_runs add constraint payroll_runs_company_cycle_key unique (company_id, period_year, period_month, cycle_no);
-- Slip sedia ada dianggap telah dilepaskan
update payroll_runs set payslip_release_at = coalesce(payslip_release_at, created_at) where status in ('paid','locked');

create table if not exists payroll_run_events (
  id        uuid primary key default gen_random_uuid(),
  run_id    uuid not null references payroll_runs(id) on delete cascade,
  action    text not null,
  note      text,
  actor     uuid references persons(id),
  at        timestamptz not null default now()
);
alter table payroll_run_events enable row level security;
drop policy if exists pre_read on payroll_run_events;
create policy pre_read on payroll_run_events for select to authenticated
  using (exists (select 1 from payroll_runs r where r.id = run_id and has_role(r.company_id, '{hr,finance,ceo,admin}')));
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant select on payroll_run_events to authenticated; end if;
end $$;

create or replace function payroll_prepare(p_company uuid, p_year int, p_month int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; d0 date := make_date(p_year, p_month, 1); d1 date; semak jsonb; ringkas jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  d1 := (d0 + interval '1 month - 1 day')::date;
  insert into payroll_runs(company_id, period_year, period_month, prepared_by)
  values (p_company, p_year, p_month, current_person_id())
  on conflict (company_id, period_year, period_month, cycle_no) do nothing;
  select * into r from payroll_runs where company_id = p_company and period_year = p_year and period_month = p_month and cycle_no = 1;
  -- Gaji yang dibatalkan (permohonan kelulusan ditarik balik) kembali ke draf supaya boleh disediakan semula
  if r.status = 'cancelled' then
    update payroll_runs set status = 'draft', approval_request_id = null, totals = null where id = r.id returning * into r;
    insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'restarted', 'cancelled', current_person_id());
  end if;

  select jsonb_build_object(
    'employees', count(*),
    'claims', (select count(*) from claims c join employments e on e.id = c.employment_id
                where e.company_id = p_company and c.status = 'approved' and c.paid_at is null
                  and (c.paid_via_payroll_run is null or c.paid_via_payroll_run = r.id)),
    'claims_amount', (select coalesce(sum(c.total_amount), 0) from claims c join employments e on e.id = c.employment_id
                where e.company_id = p_company and c.status = 'approved' and c.paid_at is null
                  and (c.paid_via_payroll_run is null or c.paid_via_payroll_run = r.id)),
    'unpaid_leave_people', (select count(distinct lr.employment_id) from leave_requests lr
                join employments e on e.id = lr.employment_id join leave_types lt on lt.id = lr.leave_type_id
               where e.company_id = p_company and lt.code = 'UL' and lr.status = 'approved'
                 and lr.start_date <= d1 and lr.end_date >= d0),
    'adjustment_people', (select count(distinct employment_id) from payroll_adjustments where payroll_run_id = r.id)
  ) into ringkas
  from employments e where e.company_id = p_company and e.join_date <= d1
    and (e.status in ('probation','active') or (e.end_date >= d0));

  -- Semakan sebelum kira (berasaskan peraturan; AI boleh menambah ulasan kemudian)
  select coalesce(jsonb_agg(x), '[]') into semak from (
    select coalesce(p.preferred_name, p.full_name) || ': belum mempunyai no. KWSP.' x
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1 and e.epf_no is null
    union all
    select coalesce(p.preferred_name, p.full_name) || ': akaun bank belum diisi.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1 and p.bank_account_no is null
    union all
    select coalesce(p.preferred_name, p.full_name) || ': gaji pokok belum ditetapkan.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and e.join_date <= d1
       and not exists (select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                        where ec.employment_id = e.id and pc.code = 'BASIC' and ec.effective_from <= d1
                          and (ec.effective_to is null or ec.effective_to >= d0))
    union all
    select coalesce(p.preferred_name, p.full_name) || ': tiada data terkumpul Jan–' ||
           (array['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov'])[p_month - 1] ||
           ' (gaji, KWSP, PCB). Isi di Profil Pekerja → Gaji supaya PCB tepat.'
      from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active') and p_month > 1
       and e.join_date < make_date(p_year, 1, 1)
       and not exists (select 1 from payroll_opening_balances ob where ob.employment_id = e.id and ob.year = p_year)
       and not exists (select 1 from payslips ps join payroll_runs pr on pr.id = ps.payroll_run_id
                        where ps.employment_id = e.id and pr.period_year = p_year and pr.period_month < p_month
                          and pr.status in ('approved','paid','locked'))    union all
    select coalesce(p.preferred_name, p.full_name) || ': gaji meningkat ' || round((s.gross / nullif(l.gross, 0) - 1) * 100)
           || '% berbanding bulan lalu — adakah ini betul?'
      from payslips s join employments e on e.id = s.employment_id join persons p on p.id = e.person_id
      join payslips l on l.employment_id = s.employment_id
      join payroll_runs lr on lr.id = l.payroll_run_id
     where s.payroll_run_id = r.id
       and make_date(lr.period_year, lr.period_month, 1) = (d0 - interval '1 month')::date
       and l.gross > 0 and s.gross > l.gross * 1.3
  ) q;

  return jsonb_build_object('run_id', r.id, 'status', r.status, 'summary', ringkas, 'checks', semak,
                            'statutory_ready', (select count(*) from statutory_rates where code in ('EPF','SOCSO','EIS','PCB')
                                                  and effective_from <= d1) >= 4);
end $$;

-- Kitaran tambahan (cth. bonus) bagi bulan yang sama
create or replace function payroll_add_cycle(p_company uuid, p_year int, p_month int, p_label text) returns uuid
language plpgsql security definer set search_path = public as $$
declare n int; rid uuid;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Sila namakan kitaran (cth. Bonus Disember)'; end if;
  select coalesce(max(cycle_no), 1) + 1 into n from payroll_runs where company_id = p_company and period_year = p_year and period_month = p_month;
  insert into payroll_runs(company_id, period_year, period_month, cycle_no, kind, label, prepared_by)
  values (p_company, p_year, p_month, n, 'additional', trim(p_label), current_person_id()) returning id into rid;
  insert into payroll_run_events(run_id, action, note, actor) values (rid, 'created', trim(p_label), current_person_id());
  return rid;
end $$;

-- Buka semula gaji yang telah diluluskan / dibayar (perlu dikira & dilulus semula)
create or replace function payroll_reopen(p_run uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('approved','paid','pending','rejected','cancelled') then raise exception 'Gaji ini belum dihantar atau diluluskan'; end if;
  if r.status = 'locked' then raise exception 'Gaji ini telah dikunci'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Sila nyatakan sebab buka semula'; end if;
  if exists (select 1 from payroll_runs x where x.company_id = r.company_id and x.status in ('approved','paid','locked','pending')
              and make_date(x.period_year, x.period_month, 1) > make_date(r.period_year, r.period_month, 1)) then
    raise exception 'Gaji bulan kemudian telah diproses. Buka semula bulan terkini dahulu.';
  end if;
  if r.status = 'pending' and r.approval_request_id is not null then
    update approval_requests set status = 'cancelled' where id = r.approval_request_id and status = 'pending';
    update approval_tasks set status = 'cancelled' where request_id = r.approval_request_id and status = 'pending';
  end if;
  update claims set paid_at = null where paid_via_payroll_run = r.id;
  update payroll_runs set status = 'calculated', approval_request_id = null, payslip_release_at = null, pay_date = null where id = r.id;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'reopened', trim(p_reason), current_person_id());
  perform emit_event(r.company_id, 'payroll.reopened', current_person_id(), null, jsonb_build_object('run_id', r.id, 'reason', trim(p_reason)));
end $$;

-- Lepaskan slip kepada pekerja (serta-merta atau pada tarikh) / tarik balik
create or replace function payroll_release_payslips(p_run uuid, p_at timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; bulan text;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('approved','paid','locked') then raise exception 'Gaji belum diluluskan'; end if;
  update payroll_runs set payslip_release_at = coalesce(p_at, now()) where id = r.id;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'released', coalesce(p_at, now())::text, current_person_id());
  if coalesce(p_at, now()) <= now() then
    bulan := (array['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'])[r.period_month] || ' ' || r.period_year;
    perform notify_person(e.person_id, r.company_id,
              'Slip gaji ' || bulan || ' anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji untuk melihatnya.')
       from payslips s join employments e on e.id = s.employment_id where s.payroll_run_id = r.id;
  end if;
end $$;

create or replace function payroll_unrelease_payslips(p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  update payroll_runs set payslip_release_at = null where id = r.id;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'unreleased', null, current_person_id());
end $$;

-- Slip boleh dilihat pekerja hanya selepas dilepaskan (atau pratonton jika dibenarkan)
create or replace function payslip_visible_status(p_run payroll_runs) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_run.status in ('approved','paid','locked') and p_run.payslip_release_at is not null and p_run.payslip_release_at <= now())
      or (p_run.status in ('calculated','pending') and p_run.kind = 'regular'
          and coalesce((select payslip_preview from companies where id = p_run.company_id), false))
$$;

-- Tanda dibayar: slip dilepaskan automatik (jika ditetapkan) — kalau tidak, HR melepaskan kemudian
create or replace function payroll_mark_paid(p_run uuid, p_pay_date date default null) returns int
language plpgsql security definer set search_path = public as $$
declare r payroll_runs; n int; auto boolean;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status <> 'approved' then raise exception 'Gaji belum diluluskan'; end if;
  update payroll_runs set status = 'paid', pay_date = coalesce(p_pay_date, (now() at time zone 'Asia/Kuala_Lumpur')::date) where id = r.id;
  update claims set paid_at = now() where paid_via_payroll_run = r.id and paid_at is null;
  insert into payroll_run_events(run_id, action, note, actor) values (r.id, 'paid', null, current_person_id());
  select coalesce((payslip_options->>'auto_release')::boolean, true) into auto from companies where id = r.company_id;
  if auto then perform payroll_release_payslips(r.id, null); end if;
  select count(*) into n from payslips where payroll_run_id = r.id;
  perform emit_event(r.company_id, 'payroll.paid', current_person_id(), null, jsonb_build_object('run_id', r.id, 'slips', n));
  return n;
end $$;

-- 3. Peta akaun GL (akaun bagi item disimpan pada pay_components.account_ref) ---------------------
alter table companies add column if not exists gl_accounts jsonb not null default '{}';

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function hr_save_pay_component(uuid, text, jsonb) from public, anon;
    grant execute on function hr_save_pay_component(uuid, text, jsonb) to authenticated;
    revoke all on function payroll_add_cycle(uuid, int, int, text) from public, anon;
    grant execute on function payroll_add_cycle(uuid, int, int, text) to authenticated;
    revoke all on function payroll_reopen(uuid, text) from public, anon;
    grant execute on function payroll_reopen(uuid, text) to authenticated;
    revoke all on function payroll_release_payslips(uuid, timestamptz) from public, anon;
    grant execute on function payroll_release_payslips(uuid, timestamptz) to authenticated;
    revoke all on function payroll_unrelease_payslips(uuid) from public, anon;
    grant execute on function payroll_unrelease_payslips(uuid) to authenticated;
    revoke all on function seed_pay_catalog(uuid) from public, anon, authenticated;
  end if;
end $$;

-- Jadual Gaji Pekerja: hanya item aktif yang digunakan / dipaparkan
create or replace function hr_pay_table(p_company uuid, p_on date default null, p_via action_channel default 'web')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_on, (now() at time zone 'Asia/Kuala_Lumpur')::date); res jsonb; baris jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;

  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), e.person_id, 'salary', p_via
    from employments e where e.company_id = p_company and e.status in ('probation','active');

  select coalesce(jsonb_agg(x.r || jsonb_build_object('calc', pay_estimate((x.r->>'employment_id')::uuid, x.r->'items', d))
                            order by x.dept nulls last, x.no), '[]')
    into baris
    from (
      select dp.name as dept, e.employee_no as no, jsonb_build_object(
               'employment_id', e.id,
               'name', coalesce(p.preferred_name, p.full_name),
               'employee_no', e.employee_no,
               'department', dp.name,
               'status', e.status,
               'join_date', e.join_date,
               'items', coalesce((
                  select jsonb_object_agg(pc.code, ec.amount)
                    from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)), '{}'),
               'effective_from', (
                  select max(ec.effective_from) from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code)
                     and ec.effective_from <= d and (ec.effective_to is null or ec.effective_to >= d)),
               'upcoming', exists (
                  select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                   where ec.employment_id = e.id and pay_component_is_fixed(pc.code) and ec.effective_from > d)) as r
        from employments e
        join persons p on p.id = e.person_id
        left join departments dp on dp.id = e.department_id
       where e.company_id = p_company and e.status in ('probation','active')
    ) x;

  select jsonb_build_object(
    'on', d,
    'components', coalesce((
      select jsonb_agg(jsonb_build_object('code', pc.code, 'name', pc.name, 'kind', pc.kind,
                                          'epf', pc.epf_applicable, 'socso', pc.socso_applicable, 'taxable', pc.taxable)
                       order by (pc.code <> 'BASIC'), pc.kind, pc.name)
        from pay_components pc where pc.company_id = p_company and pay_component_is_fixed(pc.code)
           and pc.active and pc.kind <> 'benefit' and (pc.in_table or exists (select 1 from employment_compensation ec where ec.component_id = pc.id))), '[]'),
    'rows', baris,
    'totals', (
      select jsonb_object_agg(k, s) from (
        select k, sum((b->'calc'->>k)::numeric) s
          from jsonb_array_elements(baris) b,
               unnest(array['gross','epf_employee','epf_employer','socso_employee','socso_employer','eis_employee','eis_employer','pcb','hrdf','net','employer_cost']) k
         where (b->'calc'->>'statutory_ready')::boolean
         group by k) t)
  ) into res;
  return res;
end $$;
