-- =====================================================================
--  Borang EA (C.P.8A) & Borang E / C.P.8D
--  Majikan wajib memberi Borang EA kepada setiap pekerja sebelum 28 Februari dan menghantar
--  Borang E (bersama C.P.8D) kepada LHDN sebelum 31 Mac. Angka diambil daripada slip gaji yang
--  diluluskan / dibayar bagi tahun itu + data terkumpul daripada sistem lama (payroll_opening_balances).
--
--  B1(a) gaji, elaun & kerja lebih masa (tolak potongan cuti tanpa gaji); B1(b) komisen / bonus;
--  D1 PCB; E1 KWSP (bahagian pekerja); E2 PERKESO + SIP (bahagian pekerja).
--  Bayaran balik tuntutan (CLAIM) bukan pendapatan dan tidak dimasukkan.
-- =====================================================================

create table if not exists ea_releases (
  company_id  uuid not null references companies(id) on delete cascade,
  year        int  not null,
  released_at timestamptz not null default now(),
  released_by uuid references persons(id),
  primary key (company_id, year)
);
alter table ea_releases enable row level security;
drop policy if exists read_ea_rel on ea_releases;
create policy read_ea_rel on ea_releases for select using (is_company_member(company_id));

-- Dalaman: angka EA bagi syarikat & tahun (semua pekerja, atau satu pekerjaan).
create or replace function ea_compute(p_company uuid, p_year int, p_employment uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with runs as (
    select r.id from payroll_runs r
     where r.company_id = p_company and r.period_year = p_year and r.status in ('approved','paid','locked')
  ), ps as (
    select s.* from payslips s where s.payroll_run_id in (select id from runs)
      and (p_employment is null or s.employment_id = p_employment)
  ), ln as (
    select ps.employment_id,
           sum(case when l.kind = 'earning' and l.component_code not in ('CLAIM','COMMISSION','BONUS') then l.amount
                    when l.kind = 'deduction' and l.component_code in ('UNPAID','UL') then -l.amount else 0 end) as b1a,
           sum(case when l.kind = 'earning' and l.component_code in ('COMMISSION','BONUS') then l.amount else 0 end) as b1b
      from ps join payslip_lines l on l.payslip_id = ps.id
     group by ps.employment_id
  ), agg as (
    select ps.employment_id, count(*) as months, sum(ps.pcb) as pcb, sum(ps.epf_employee) as epf,
           sum(ps.socso_employee + ps.eis_employee) as socso
      from ps group by ps.employment_id
  ), ob as (
    select o.* from payroll_opening_balances o
      join employments e on e.id = o.employment_id
     where e.company_id = p_company and o.year = p_year and (p_employment is null or o.employment_id = p_employment)
  ), ids as (
    select employment_id from agg union select employment_id from ob
  )
  select coalesce(jsonb_agg(x order by x.employee_no), '[]'::jsonb) from (
    select e.id as employment_id, e.employee_no, p.id as person_id, p.full_name, p.ic_no, e.tax_no, e.epf_no, e.socso_no,
           ps2.title as position,
           case when extract(year from e.join_date) = p_year then e.join_date end as join_date,
           case when e.end_date is not null and extract(year from e.end_date) = p_year then e.end_date end as end_date,
           coalesce(agg.months, 0) + coalesce(ob.up_to_month, 0) as months,
           round(coalesce(ln.b1a, 0) + coalesce(ob.gross, 0), 2) as b1a,
           round(coalesce(ln.b1b, 0), 2) as b1b,
           round(coalesce(ln.b1a, 0) + coalesce(ob.gross, 0) + coalesce(ln.b1b, 0), 2) as total_income,
           round(coalesce(agg.pcb, 0) + coalesce(ob.pcb, 0), 2) as pcb,
           round(coalesce(agg.epf, 0) + coalesce(ob.epf, 0), 2) as epf,
           round(coalesce(agg.socso, 0), 2) as socso,
           (ob.employment_id is not null) as has_opening
      from ids
      join employments e on e.id = ids.employment_id
      join persons p on p.id = e.person_id
      left join positions ps2 on ps2.id = e.position_id
      left join agg on agg.employment_id = e.id
      left join ln on ln.employment_id = e.id
      left join ob on ob.employment_id = e.id
  ) x
$$;
revoke all on function ea_compute(uuid, int, uuid) from public, anon, authenticated;

create or replace function ea_company_header(p_company uuid, p_year int)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', c.name, 'reg_no', c.reg_no, 'address', c.address, 'lhdn_employer_no', c.lhdn_employer_no,
           'epf_employer_no', c.epf_employer_no, 'year', p_year,
           'released_at', (select released_at from ea_releases r where r.company_id = c.id and r.year = p_year))
    from companies c where c.id = p_company
$$;
revoke all on function ea_company_header(uuid, int) from public, anon, authenticated;

-- HR / Kewangan / Pentadbir: semua Borang EA bagi tahun itu (juga untuk Borang E & C.P.8D).
create or replace function hr_ea(p_company uuid, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rows jsonb;
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  rows := ea_compute(p_company, p_year);
  -- Borang EA mengandungi no. kad pengenalan & pendapatan: rekod akses (PDPA)
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), (r->>'person_id')::uuid, 'ea', 'web' from jsonb_array_elements(rows) r;
  return jsonb_build_object('company', ea_company_header(p_company, p_year), 'rows', rows);
end $$;

-- Pekerja: Borang EA sendiri (selepas HR mengeluarkan Borang EA bagi tahun itu).
create or replace function my_ea(p_employment uuid, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.person_id is distinct from current_person_id() then raise exception 'Tidak dibenarkan'; end if;
  if not exists (select 1 from ea_releases where company_id = e.company_id and year = p_year) then
    return jsonb_build_object('released', false);
  end if;
  return jsonb_build_object('released', true, 'company', ea_company_header(e.company_id, p_year),
                            'row', ea_compute(e.company_id, p_year, p_employment)->0);
end $$;

-- HR: keluarkan Borang EA kepada pekerja (dipaparkan di Slip Gaji + WhatsApp).
create or replace function hr_ea_release(p_company uuid, p_year int)
returns int language plpgsql security definer set search_path = public as $$
declare r jsonb; n int := 0;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if p_year >= extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::int then
    raise exception 'Borang EA hanya boleh dikeluarkan selepas tahun berakhir';
  end if;
  insert into ea_releases(company_id, year, released_by) values (p_company, p_year, current_person_id())
  on conflict (company_id, year) do update set released_at = now(), released_by = excluded.released_by;
  for r in select * from jsonb_array_elements(ea_compute(p_company, p_year)) loop
    perform notify_person((r->>'person_id')::uuid, p_company,
      'Borang EA ' || p_year || ' anda telah tersedia. Buka aplikasi HRBoost → Saya → Slip Gaji → Borang EA.');
    n := n + 1;
  end loop;
  return n;
end $$;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Borang EA (\d{4}) anda telah tersedia\. Buka aplikasi HRBoost → Saya → Slip Gaji → Borang EA\.$$q$,
   $q$Your \1 Form EA is now available. Open the HRBoost app → Me → Payslip → Form EA.$q$, 121, true)
on conflict (kind, ms) do update set en = excluded.en;

revoke all on function hr_ea(uuid, int) from public, anon;
revoke all on function my_ea(uuid, int) from public, anon;
revoke all on function hr_ea_release(uuid, int) from public, anon;
grant execute on function hr_ea(uuid, int) to authenticated;
grant execute on function my_ea(uuid, int) to authenticated;
grant execute on function hr_ea_release(uuid, int) to authenticated;
