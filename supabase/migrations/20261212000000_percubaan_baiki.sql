-- =====================================================================
--  Pembaikan daripada percubaan syarikat (Safar Kembara, 10 pekerja):
--   1. Nama panggilan lalai melangkau awalan nama Melayu/India/Cina biasa (Mohd, Nur, Siti, Wan, A/L ...)
--   2. Import: lajur Ketua boleh merujuk pekerja sedia ada (cth. pengasas) — jabatan tanpa ketua ditetapkan
--   3. Ketua jabatan tanpa jabatan (pengasas) dimasukkan ke jabatan yang diketuainya
--   4. Pengasas tidak mendapat senarai semak pekerja baharu; HR boleh mengubah tarikh mula pekerja
--   5. Keterangan OT pada slip: "Kerja Lebih Masa (diluluskan): 3 jam"
-- =====================================================================

create or replace function nama_panggilan_lalai(p_nama text) returns text
language sql immutable as $$
  select coalesce(
    (select w from unnest(string_to_array(initcap(regexp_replace(trim(coalesce(p_nama, '')), '\s+', ' ', 'g')), ' ')) with ordinality t(w, n)
      where lower(regexp_replace(w, '[^A-Za-z]', '', 'g')) not in
            ('mohd','mohamad','mohammad','mohamed','mohammed','muhammad','muhamad','muhd','md','mhd','mat',
             'nur','nor','noor','nurul','siti','sitti','wan','nik','che','syed','sharifah','syarifah','tengku','tunku','raja',
             'abdul','abd','ab','haji','hajah','hj','hjh','dato','datuk','datin','dr','ir','puan','encik','cik')
        and length(regexp_replace(w, '[^A-Za-z]', '', 'g')) >= 2
      order by n limit 1),
    split_part(initcap(trim(coalesce(p_nama, ''))), ' ', 1))
$$;

create or replace function register_company_email(p_company_name text, p_size text, p_full_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pid uuid; cid uuid; v_code text; i int := 0;
  nama text := trim(p_full_name);
  emel text := current_verified_email();
  telefon text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'Sila log masuk dahulu'; end if;
  if emel is null then raise exception 'Sila sahkan e-mel anda dahulu melalui pautan yang dihantar'; end if;
  if coalesce((platform_setting('registration_open') #>> '{}')::boolean, true) is false then
    raise exception 'Pendaftaran syarikat baru ditutup sementara';
  end if;
  if coalesce(trim(p_company_name), '') = '' or length(trim(p_company_name)) > 120 then raise exception 'Sila isi nama syarikat'; end if;
  if coalesce(nama, '') = '' then raise exception 'Sila isi nama penuh anda'; end if;
  if telefon is not null then
    if telefon like '0%' then telefon := '6' || telefon; end if;
    if telefon !~ '^601\d{8,9}$' then raise exception 'Nombor WhatsApp tidak sah'; end if;
  end if;

  select id into pid from persons where auth_user_id = auth.uid();
  -- Pautan pengesahan boleh dibuka lebih sekali: jangan cipta syarikat yang sama dua kali
  if pid is not null then
    select c.id into cid from companies c
     where c.created_by = pid and c.name = upper(trim(p_company_name)) and c.created_at > now() - interval '1 day'
     limit 1;
    if cid is not null then return cid; end if;
  end if;
  if pid is not null and (select count(*) from companies c where c.created_by = pid and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Had pendaftaran harian dicapai. Cuba lagi esok.';
  end if;

  if pid is null then
    -- Rekod sedia ada (contoh diimport oleh HR) dengan e-mel atau telefon yang sama dan belum mempunyai akaun
    select id into pid from persons where auth_user_id is null
       and (lower(email) = emel or (telefon is not null and phone_whatsapp = telefon)) limit 1;
    if pid is null then
      insert into persons(auth_user_id, full_name, preferred_name, phone_whatsapp, email)
      values (auth.uid(), upper(nama), nama_panggilan_lalai(nama), telefon, emel)
      returning id into pid;
    else
      update persons set auth_user_id = auth.uid(), email = coalesce(email, emel),
             phone_whatsapp = coalesce(phone_whatsapp, telefon) where id = pid;
    end if;
  else
    update persons set email = coalesce(email, emel), phone_whatsapp = coalesce(phone_whatsapp, telefon) where id = pid;
  end if;

  v_code := upper(left(regexp_replace(regexp_replace(p_company_name, '\m(syarikat|perniagaan|sdn|bhd|berhad|enterprise|plt|the)\M', '', 'gi'), '[^A-Za-z]', '', 'g'), 4));
  if v_code = '' then v_code := 'CO'; end if;
  while exists (select 1 from companies c where c.code = v_code || case when i = 0 then '' else i::text end) loop
    i := i + 1;
  end loop;
  v_code := v_code || case when i = 0 then '' else i::text end;
  insert into companies(code, name, created_by, size_band, wa_monthly_limit, ai_monthly_limit)
  values (v_code, upper(trim(p_company_name)), pid,
          case when replace(coalesce(p_size, ''), '-', '–') in ('1–10','11–50','51–200','200+') then replace(p_size, '-', '–') end,
          null, null) returning id into cid;
  insert into employments(person_id, company_id, employee_no, status, join_date)
  values (pid, cid, v_code || '001', 'active', (now() at time zone 'Asia/Kuala_Lumpur')::date);
  insert into user_roles(person_id, company_id, role) values (pid, cid, 'admin'), (pid, cid, 'hr'), (pid, cid, 'ceo');
  perform seed_company_defaults(cid);
  -- Pengasas bukan pekerja baharu: tiada senarai semak orientasi
  delete from onboarding_checklist_items where employment_id = (select id from employments where person_id = pid and company_id = cid);
  insert into company_onboarding_progress(company_id, step) values (cid, 'admin');
  perform log_platform('company.register', cid, 'company', cid, jsonb_build_object('size', p_size, 'via', 'email'));
  return cid;
end $$;

create or replace function import_employees(p_company uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; i int := 0; dept uuid; eid uuid; ok int := 0; gagal jsonb := '[]'; tel text; ic text; tarikh date; k record; hp uuid;
        ketua jsonb := '[]';
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'Data import tidak sah (maksimum 1000 baris)'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if coalesce(trim(r->>'full_name'), '') = '' then raise exception 'Tiada nama'; end if;
      tel := regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g');
      if tel <> '' then
        tel := case when tel ~ '^0' then '6' || tel when tel ~ '^1' then '60' || tel else tel end;
        if tel !~ '^601\d{8,9}$' then raise exception 'No. WhatsApp tidak sah'; end if;
      end if;
      ic := regexp_replace(coalesce(r->>'ic', ''), '\D', '', 'g');
      if ic <> '' and length(ic) <> 12 then raise exception 'No. kad pengenalan tidak sah'; end if;
      if ic <> '' then ic := substr(ic,1,6) || '-' || substr(ic,7,2) || '-' || substr(ic,9,4); end if;
      tarikh := coalesce(nullif(r->>'join_date', '')::date, (now() at time zone 'Asia/Kuala_Lumpur')::date);
      dept := null;
      if coalesce(trim(r->>'department'), '') <> '' then
        insert into departments(company_id, name) values (p_company, initcap(trim(r->>'department')))
        on conflict (company_id, name) do update set name = excluded.name returning id into dept;
      end if;
      if exists (select 1 from employments e join persons p on p.id = e.person_id where e.company_id = p_company
                  and e.status in ('probation','active') and ((tel <> '' and p.phone_whatsapp = tel) or (ic <> '' and p.ic_no = ic))) then
        raise exception 'Sudah wujud dalam syarikat ini';
      end if;
      eid := add_employee(p_company, upper(trim(r->>'full_name')),
                          coalesce(nullif(trim(r->>'preferred_name'), ''), nama_panggilan_lalai(r->>'full_name')),
                          nullif(tel, ''), nullif(ic, ''), dept, nullif(trim(r->>'position'), ''), tarikh,
                          coalesce(nullif(r->>'type', ''), 'permanent')::employment_type, 0, nullif(r->>'basic', '')::numeric);
      if coalesce((r->>'is_head')::boolean, false) and dept is not null then
        update departments set head_person_id = (select person_id from employments where id = eid) where id = dept;
        update employments set manager_person_id = (select person_id from employments where id = eid)
         where department_id = dept and id <> eid;
      end if;
      if coalesce(trim(r->>'head_name'), '') <> '' and dept is not null then
        ketua := ketua || jsonb_build_object('dept', dept, 'eid', eid, 'nama', trim(r->>'head_name'));
      end if;
      ok := ok + 1;
    exception when others then
      gagal := gagal || jsonb_build_object('row', i, 'name', r->>'full_name', 'error', sqlerrm);
    end;
  end loop;
  -- Lajur "Ketua" merujuk pekerja sedia ada (cth. pengasas / Pentadbir yang tiada dalam fail):
  -- jabatan tanpa ketua mendapat orang itu sebagai ketua, dan pengurus setiap baris ditetapkan
  for k in select distinct x->>'dept' as dept, x->>'nama' as nama from jsonb_array_elements(ketua) x loop
    select e.person_id into hp from employments e join persons p on p.id = e.person_id
     where e.company_id = p_company and e.status in ('probation','active')
       and (lower(p.full_name) = lower(k.nama) or lower(coalesce(p.preferred_name, '')) = lower(k.nama))
     limit 1;
    if hp is not null then
      update departments set head_person_id = hp where id = k.dept::uuid and head_person_id is null;
      update employments set department_id = k.dept::uuid where person_id = hp and company_id = p_company and department_id is null;
    end if;
  end loop;
  -- pekerja yang diimport sebelum ketua jabatannya: tetapkan pengurus
  update employments e set manager_person_id = d.head_person_id from departments d
   where e.department_id = d.id and e.company_id = p_company and e.manager_person_id is null
     and d.head_person_id is not null and e.person_id <> d.head_person_id;
  if ok > 0 then
    insert into company_onboarding_progress(company_id, step) values (p_company, 'import') on conflict do nothing;
  end if;
  perform emit_event(p_company, 'employees.imported', current_person_id(), null, jsonb_build_object('created', ok));
  return jsonb_build_object('created', ok, 'failed', gagal);
end $$;

create or replace function set_department_head(p_department uuid, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d departments;
begin
  select * into d from departments where id = p_department;
  if d.id is null or not has_role(d.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_person is not null and not exists (select 1 from employments where person_id = p_person and company_id = d.company_id
                                           and status in ('probation','active')) then
    raise exception 'Ketua mesti pekerja syarikat ini';
  end if;
  update departments set head_person_id = p_person where id = d.id;
  -- Ketua yang belum mempunyai jabatan (cth. pengasas) dimasukkan ke jabatan ini
  update employments set department_id = d.id
   where person_id = p_person and company_id = d.company_id and department_id is null and status in ('probation','active');
  update employments set manager_person_id = p_person
   where department_id = d.id and status in ('probation','active') and person_id is distinct from p_person;
end $$;

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
    values (r.id, x.employment_id, 'OT_LULUS', x.amt, fmt_num(x.jam) || ' jam');
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

-- HR menukar tarikh mula pekerja (cth. pengasas atau pekerja sedia ada yang dimasukkan dengan tarikh salah)
create or replace function hr_set_join_date(p_employment uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare e employments;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or not has_role(e.company_id, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_date is null or p_date > current_date + 365 or p_date < date '1960-01-01' then raise exception 'Tarikh mula tidak sah'; end if;
  if exists (select 1 from payroll_runs r join payslips s on s.payroll_run_id = r.id
              where s.employment_id = e.id and r.status in ('approved','paid','locked')
                and make_date(r.period_year, r.period_month, 1) < date_trunc('month', p_date)) then
    raise exception 'Gaji telah dibayar sebelum tarikh ini. Tarikh mula tidak boleh selepas gaji pertama.';
  end if;
  update employments set join_date = p_date where id = e.id;
  -- gaji tetap yang bermula pada tarikh mula lama mengikut tarikh baharu
  update employment_compensation set effective_from = p_date where employment_id = e.id and effective_from = e.join_date;
  -- bukan lagi pekerja baharu: buang senarai semak orientasi yang belum selesai
  if p_date < current_date - 30 then
    delete from onboarding_checklist_items where employment_id = e.id and done_at is null;
  end if;
  insert into data_access_log(actor_person_id, subject_person_id, resource, via) values (current_person_id(), e.person_id, 'profile_edit', 'web');
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function hr_set_join_date(uuid, date) from public, anon;
    grant execute on function hr_set_join_date(uuid, date) to authenticated;
  end if;
end $$;
