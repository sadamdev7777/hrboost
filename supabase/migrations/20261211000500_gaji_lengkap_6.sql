-- =====================================================================
--  Gaji lengkap — asas kiraan "tetap N hari" (cth. BrioHR MTB: cuti tanpa gaji ÷ 31 hari tetap)
-- =====================================================================
alter table companies add column if not exists fixed_days int not null default 26 check (fixed_days between 20 and 31);
alter table companies drop constraint if exists companies_prorate_basis_check;
alter table companies drop constraint if exists companies_unpaid_basis_check;
alter table companies drop constraint if exists companies_ot_basis_check;
alter table companies add constraint companies_prorate_basis_check check (prorate_basis in ('calendar','working','fixed26','fixed'));
alter table companies add constraint companies_unpaid_basis_check check (unpaid_basis in ('calendar','working','fixed26','fixed'));
alter table companies add constraint companies_ot_basis_check check (ot_basis in ('calendar','working','fixed26','fixed'));

create or replace function pay_divisor(p_company uuid, p_basis text, p_from date, p_to date) returns numeric
language sql stable security definer set search_path = public as $$
  select case p_basis when 'calendar' then (p_to - p_from + 1)::numeric
                      when 'working' then greatest(company_working_days(p_company, p_from, p_to), 1)::numeric
                      when 'fixed' then coalesce((select fixed_days from companies where id = p_company), 26)::numeric
                      else 26 end
$$;

create or replace function pay_fraction(p_company uuid, p_basis text, p_d0 date, p_d1 date, p_join date, p_end date) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare a date := greatest(p_d0, p_join); b date := least(p_d1, coalesce(p_end, p_d1));
begin
  if b < a then return 0; end if;
  if a = p_d0 and b = p_d1 then return 1; end if;
  if p_basis = 'calendar' then return (b - a + 1)::numeric / (p_d1 - p_d0 + 1); end if;
  if p_basis = 'working' then return company_working_days(p_company, a, b)::numeric / greatest(company_working_days(p_company, p_d0, p_d1), 1); end if;
  if p_basis = 'fixed' then return least((b - a + 1)::numeric / pay_divisor(p_company, 'fixed', p_d0, p_d1), 1); end if;
  return least(company_working_days(p_company, a, b)::numeric / 26, 1);   -- fixed26
end $$;

create or replace function hr_set_payroll_settings(p_company uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
  dibenar constant text[] := array['reg_no','lhdn_employer_no','lhdn_c_no','epf_employer_no','socso_employer_no','zakat_no','hrdf_registered',
    'signatory_name','signatory_ic','signatory_position','signatory_email','signatory_phone','company_bank_name','company_bank_account',
    'bank_corporate_id','bank_batch_id','payday','hours_per_day','prorate_basis','unpaid_basis','ot_basis','fixed_days','unpaid_items','ot_items',
    'skbbk_default','payslip_options','gl_accounts','epf_employer_rate'];
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  for k in select jsonb_object_keys(p_data) loop
    if not k = any(dibenar) then raise exception 'Medan tidak dikenali: %', k; end if;
  end loop;
  update companies c set
    reg_no = case when p_data ? 'reg_no' then nullif(trim(p_data->>'reg_no'), '') else c.reg_no end,
    lhdn_employer_no = case when p_data ? 'lhdn_employer_no' then nullif(trim(p_data->>'lhdn_employer_no'), '') else c.lhdn_employer_no end,
    lhdn_c_no = case when p_data ? 'lhdn_c_no' then nullif(trim(p_data->>'lhdn_c_no'), '') else c.lhdn_c_no end,
    epf_employer_no = case when p_data ? 'epf_employer_no' then nullif(trim(p_data->>'epf_employer_no'), '') else c.epf_employer_no end,
    socso_employer_no = case when p_data ? 'socso_employer_no' then nullif(trim(p_data->>'socso_employer_no'), '') else c.socso_employer_no end,
    zakat_no = case when p_data ? 'zakat_no' then nullif(trim(p_data->>'zakat_no'), '') else c.zakat_no end,
    hrdf_registered = case when p_data ? 'hrdf_registered' then (p_data->>'hrdf_registered')::boolean else c.hrdf_registered end,
    signatory_name = case when p_data ? 'signatory_name' then nullif(trim(p_data->>'signatory_name'), '') else c.signatory_name end,
    signatory_ic = case when p_data ? 'signatory_ic' then nullif(trim(p_data->>'signatory_ic'), '') else c.signatory_ic end,
    signatory_position = case when p_data ? 'signatory_position' then nullif(trim(p_data->>'signatory_position'), '') else c.signatory_position end,
    signatory_email = case when p_data ? 'signatory_email' then nullif(trim(p_data->>'signatory_email'), '') else c.signatory_email end,
    signatory_phone = case when p_data ? 'signatory_phone' then nullif(trim(p_data->>'signatory_phone'), '') else c.signatory_phone end,
    company_bank_name = case when p_data ? 'company_bank_name' then nullif(trim(p_data->>'company_bank_name'), '') else c.company_bank_name end,
    company_bank_account = case when p_data ? 'company_bank_account' then nullif(digits(p_data->>'company_bank_account'), '') else c.company_bank_account end,
    bank_corporate_id = case when p_data ? 'bank_corporate_id' then nullif(trim(p_data->>'bank_corporate_id'), '') else c.bank_corporate_id end,
    bank_batch_id = case when p_data ? 'bank_batch_id' then nullif(trim(p_data->>'bank_batch_id'), '') else c.bank_batch_id end,
    payday = case when p_data ? 'payday' then (p_data->>'payday')::int else c.payday end,
    hours_per_day = case when p_data ? 'hours_per_day' then (p_data->>'hours_per_day')::numeric else c.hours_per_day end,
    prorate_basis = case when p_data ? 'prorate_basis' then p_data->>'prorate_basis' else c.prorate_basis end,
    unpaid_basis = case when p_data ? 'unpaid_basis' then p_data->>'unpaid_basis' else c.unpaid_basis end,
    ot_basis = case when p_data ? 'ot_basis' then p_data->>'ot_basis' else c.ot_basis end,
    fixed_days = case when p_data ? 'fixed_days' then (p_data->>'fixed_days')::int else c.fixed_days end,
    unpaid_items = case when p_data ? 'unpaid_items' then array(select jsonb_array_elements_text(p_data->'unpaid_items')) else c.unpaid_items end,
    ot_items = case when p_data ? 'ot_items' then array(select jsonb_array_elements_text(p_data->'ot_items')) else c.ot_items end,
    skbbk_default = case when p_data ? 'skbbk_default' then (p_data->>'skbbk_default')::boolean else c.skbbk_default end,
    payslip_options = case when p_data ? 'payslip_options' then c.payslip_options || (p_data->'payslip_options') else c.payslip_options end,
    gl_accounts = case when p_data ? 'gl_accounts' then p_data->'gl_accounts' else c.gl_accounts end,
    epf_employer_rate = case when p_data ? 'epf_employer_rate' then nullif(p_data->>'epf_employer_rate', '')::numeric else c.epf_employer_rate end
  where c.id = p_company;
end $$;
