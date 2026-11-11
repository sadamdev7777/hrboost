-- =====================================================================
--  Gaji lengkap — UI: metadata slip (kitaran tambahan, pilihan slip), senarai slip dengan label kitaran,
--  data CP22 (pemberitahuan pekerja baharu) & penyata PCB II.
-- =====================================================================

create or replace function payslip_meta(p_payslip uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('period_year', r.period_year, 'period_month', r.period_month, 'pay_date', r.pay_date,
           'status', r.status, 'kind', r.kind, 'label', r.label, 'cycle_no', r.cycle_no,
           'options', c.payslip_options,
           'company', jsonb_build_object('name', c.name, 'code', c.code, 'reg_no', c.reg_no,
           'epf', c.epf_employer_no, 'socso', c.socso_employer_no, 'lhdn', c.lhdn_employer_no, 'logo_path', c.logo_path))
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join companies c on c.id = r.company_id
    join employments e on e.id = s.employment_id
   where s.id = p_payslip
     and ((e.person_id = current_person_id() and payslip_visible_status(r))
          or has_role(r.company_id, '{hr,finance,ceo,admin}'))
$$;

drop function if exists my_payslips(uuid);
create function my_payslips(p_employment uuid)
returns table(id uuid, period_year int, period_month int, pay_date date, status payroll_status, net numeric, draft boolean, issue_open boolean, label text)
language sql stable security definer set search_path = public as $$
  select s.id, r.period_year, r.period_month, r.pay_date, r.status, s.net,
         r.status in ('calculated','pending'),
         exists (select 1 from payslip_issues i where i.payroll_run_id = r.id and i.employment_id = s.employment_id and i.resolved_at is null),
         case when r.kind = 'additional' then r.label end
    from payslips s join payroll_runs r on r.id = s.payroll_run_id join employments e on e.id = s.employment_id
   where s.employment_id = p_employment and e.person_id = current_person_id() and payslip_visible_status(r)
   order by r.period_year desc, r.period_month desc, r.cycle_no desc
$$;

-- Data CP22 (borang pemberitahuan pekerja baharu kepada LHDN — dalam tempoh 30 hari mula bekerja)
create or replace function cp22_data(p_employment uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare e employments; out jsonb;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Tidak dibenarkan'; end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'cp22', 'web');
  select jsonb_build_object(
    'employee', jsonb_build_object('full_name', p.full_name, 'ic_no', p.ic_no, 'passport_no', p.passport_no, 'nationality', p.nationality,
                  'date_of_birth', p.date_of_birth, 'gender', p.gender, 'marital_status', p.marital_status, 'address', p.address,
                  'phone', p.phone_whatsapp, 'email', p.email, 'tax_no', e.tax_no, 'epf_no', e.epf_no, 'employee_no', e.employee_no,
                  'join_date', e.join_date, 'position', ps.title, 'children', p.children_count, 'spouse_working', p.spouse_working,
                  'basic', (select sum(ec.amount) from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                             where ec.employment_id = e.id and pc.code = 'BASIC' and (ec.effective_to is null or ec.effective_to >= current_date))),
    'employer', jsonb_build_object('name', c.name, 'reg_no', c.reg_no, 'lhdn', c.lhdn_employer_no, 'address', c.address,
                  'signatory_name', c.signatory_name, 'signatory_position', c.signatory_position, 'signatory_ic', c.signatory_ic,
                  'signatory_phone', c.signatory_phone, 'signatory_email', c.signatory_email, 'logo_path', c.logo_path))
    into out
    from persons p join companies c on c.id = e.company_id left join positions ps on ps.id = e.position_id
   where p.id = e.person_id;
  return out;
end $$;

-- Penyata potongan PCB setahun (PCB II) untuk seorang pekerja
create or replace function pcb_ii_data(p_employment uuid, p_year int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare e employments; out jsonb;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not (has_role(e.company_id, '{hr,finance,admin}') or e.person_id = current_person_id()) then raise exception 'Tidak dibenarkan'; end if;
  if e.person_id <> current_person_id() then
    insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'pcb_ii', 'web');
  end if;
  select jsonb_build_object(
    'employee', jsonb_build_object('full_name', p.full_name, 'ic_no', p.ic_no, 'passport_no', p.passport_no, 'tax_no', e.tax_no, 'employee_no', e.employee_no),
    'employer', jsonb_build_object('name', c.name, 'lhdn', c.lhdn_employer_no, 'address', c.address, 'signatory_name', c.signatory_name,
                  'signatory_position', c.signatory_position, 'logo_path', c.logo_path),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('month', r.period_month, 'cycle_no', r.cycle_no, 'label', r.label, 'pcb', s.pcb, 'cp38', s.cp38,
                         'zakat', s.zakat, 'receipt_no', r.pcb_receipt_no, 'pay_date', r.pay_date) order by r.period_month, r.cycle_no)
                        from payslips s join payroll_runs r on r.id = s.payroll_run_id
                       where s.employment_id = e.id and r.period_year = p_year and r.status in ('approved','paid','locked')), '[]'::jsonb))
    into out
    from persons p join companies c on c.id = e.company_id where p.id = e.person_id;
  return out;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function my_payslips(uuid) from public, anon;
    grant execute on function my_payslips(uuid) to authenticated;
    revoke all on function cp22_data(uuid) from public, anon;
    grant execute on function cp22_data(uuid) to authenticated;
    revoke all on function pcb_ii_data(uuid, int) from public, anon;
    grant execute on function pcb_ii_data(uuid, int) to authenticated;
  end if;
end $$;
