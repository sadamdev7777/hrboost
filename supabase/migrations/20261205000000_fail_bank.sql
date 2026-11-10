-- =====================================================================
--  Fail bayaran gaji mengikut format bank (Maybank2u Biz, CIMB BizChannel, dll.).
--  Fail dibina di pelayar daripada baris bayaran (payroll_bank_rows) mengikut format yang dipilih;
--  format lajur setiap syarikat disimpan supaya HR tidak perlu menyusun semula setiap bulan.
-- =====================================================================

alter table companies add column if not exists bank_file_format jsonb;

-- Baris bayaran bagi satu larian gaji yang telah diluluskan (HR / Kewangan / Pentadbir sahaja).
create or replace function payroll_bank_rows(p_run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r payroll_runs; rows jsonb;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null then raise exception 'Larian gaji tidak dijumpai'; end if;
  if not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if r.status not in ('approved','paid','locked') then
    raise exception 'Fail bank hanya boleh dimuat turun selepas gaji diluluskan';
  end if;
  select coalesce(jsonb_agg(x order by x.full_name), '[]'::jsonb) into rows from (
    select e.employee_no, p.id as person_id, p.full_name, p.ic_no, p.email, p.bank_name, p.bank_account_no,
           round(s.net, 2) as net
      from payslips s
      join employments e on e.id = s.employment_id
      join persons p on p.id = e.person_id
     where s.payroll_run_id = r.id and s.net > 0
  ) x;
  -- Akaun bank orang lain dibuka: rekod (PDPA)
  insert into data_access_log(actor_person_id, subject_person_id, resource, via)
  select current_person_id(), (x->>'person_id')::uuid, 'bank', 'web' from jsonb_array_elements(rows) x;
  return jsonb_build_object('period_year', r.period_year, 'period_month', r.period_month, 'pay_date', r.pay_date, 'rows', rows);
end $$;

-- Simpan format fail bank syarikat (lajur, pemisah, format tarikh & amaun).
create or replace function set_bank_file_format(p_company uuid, p_format jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Tidak dibenarkan'; end if;
  if p_format is not null and (jsonb_typeof(p_format) <> 'object' or jsonb_typeof(p_format->'columns') <> 'array') then
    raise exception 'Format fail bank tidak sah';
  end if;
  if length(coalesce(p_format::text, '')) > 20000 then raise exception 'Format fail bank terlalu besar'; end if;
  update companies set bank_file_format = p_format where id = p_company;
end $$;

revoke all on function payroll_bank_rows(uuid) from public, anon;
revoke all on function set_bank_file_format(uuid, jsonb) from public, anon;
grant execute on function payroll_bank_rows(uuid) to authenticated;
grant execute on function set_bank_file_format(uuid, jsonb) to authenticated;
