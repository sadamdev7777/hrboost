-- =====================================================================
--  Kawalan PCB (selepas gaji November 2026 keluar dengan PCB RM0 kerana data terkumpul Jan–Okt tiada)
--   A0/A. Semakan PCB bagi setiap gaji: (i) data terkumpul (YTD) tahun ini tidak lengkap,
--         (ii) gaji tertakluk PCB (unjuran setahun) tetapi PCB dikira RM0.
--         Gaji tidak boleh dihantar / diluluskan selagi setiap pekerja yang ditanda tiada sebab.
--         Sebab disimpan sebagai log (tambah sahaja; tiada ubah / padam).
--   B.    Notis PCB kepada HR & Kewangan (dan pekerja) apabila gaji mula tertakluk PCB,
--         dan apabila kiraan gaji menemui PCB RM0 bagi gaji yang tertakluk.
--   C.    Data cukai wajib dalam orientasi pekerja + senarai "Data cukai tidak lengkap" untuk HR.
--  Tiada data sedia ada diubah. Gaji yang telah diluluskan / dibayar tidak terjejas.
-- =====================================================================

-- ---------- A. Log sebab pengecualian ----------
create table payroll_pcb_exceptions (
  id              uuid primary key default gen_random_uuid(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  employment_id   uuid not null references employments(id) on delete cascade,
  reason          text not null check (reason in ('tp1','zakat','staf_baharu','bukan_pemastautin','lain')),
  note            text,
  created_by      uuid references persons(id),
  created_at      timestamptz not null default now()
);
create index payroll_pcb_exceptions_run_idx on payroll_pcb_exceptions(payroll_run_id, employment_id, created_at desc);
alter table payroll_pcb_exceptions enable row level security;

create table payroll_pcb_alerts (
  payroll_run_id uuid not null references payroll_runs(id) on delete cascade,
  employment_id  uuid not null references employments(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (payroll_run_id, employment_id)
);
alter table payroll_pcb_alerts enable row level security;

-- Pekerja yang ditanda bagi satu gaji (kitaran biasa sahaja; kitaran tambahan dikira dengan kaedah PCB tambahan)
create or replace function _pcb_flags(p_run uuid)
returns table(employment_id uuid, employee_no text, name text, gross numeric, pcb numeric,
              annual_pcb numeric, missing_months int[], kinds text[])
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs; d0 date; d1 date;
begin
  select * into r from payroll_runs x where x.id = p_run;
  if r.id is null or coalesce(r.kind, 'regular') = 'additional' then return; end if;
  d0 := make_date(r.period_year, r.period_month, 1);
  d1 := (d0 + interval '1 month - 1 day')::date;
  return query
  with s as (
    select ps.employment_id, e.employee_no, coalesce(p.full_name, p.preferred_name) as nama, e.join_date,
           ps.gross, ps.pcb, ps.epf_employee, ps.zakat, p.marital_status, p.spouse_working,
           (select coalesce(sum(case when pc.taxable then case when l.kind in ('earning','benefit') then l.amount
                                                                when l.component_code = 'UNPAID' then -l.amount else 0 end else 0 end), 0)
              from payslip_lines l left join pay_components pc on pc.company_id = r.company_id and pc.code = l.component_code
             where l.payslip_id = ps.id) as tx,
           (select ob.up_to_month from payroll_opening_balances ob
             where ob.employment_id = ps.employment_id and ob.year = r.period_year and ob.up_to_month < r.period_month) as ob_bulan
      from payslips ps join employments e on e.id = ps.employment_id join persons p on p.id = e.person_id
     where ps.payroll_run_id = r.id
  ), f as (
    select s.*,
           -- Unjuran setahun pada gaji bulan ini (seolah-olah Januari tanpa data terkumpul)
           case when st.resident and s.pcb = 0 and s.tx > 0 then
             stat_pcb2(1, d1, 0, 0, 0, s.tx, s.epf_employee, s.marital_status in ('berkahwin','married'), s.spouse_working,
                       st.child_units, st.extra_relief, 0,
                       coalesce((select sum(t.amount) from tp1_reliefs t where t.employment_id = s.employment_id
                                    and t.year = r.period_year and t.month = r.period_month), 0),
                       0, s.zakat, true)
           else 0 end as ap,
           -- Bulan tahun ini sebelum bulan gaji yang tiada slip diluluskan dan tidak diliputi baki awal
           (select coalesce(array_agg(m order by m), '{}') from generate_series(
               case when s.join_date < make_date(r.period_year, 1, 1) then 1 else extract(month from s.join_date)::int end,
               r.period_month - 1) m
             where m > coalesce(s.ob_bulan, 0)
               and not exists (select 1 from payslips x join payroll_runs y on y.id = x.payroll_run_id
                                where x.employment_id = s.employment_id and y.company_id = r.company_id
                                  and y.period_year = r.period_year and y.period_month = m
                                  and y.status in ('approved','paid','locked'))) as tiada
      from s cross join lateral employment_stat_effective(s.employment_id, d1) st
  )
  select f.employment_id, f.employee_no, f.nama, f.gross, f.pcb, f.ap, f.tiada,
         array_remove(array[case when cardinality(f.tiada) > 0 then 'ytd' end, case when f.ap > 0 then 'pcb0' end], null)
    from f
   where cardinality(f.tiada) > 0 or f.ap > 0
   order by f.employee_no;
end $$;
revoke execute on function _pcb_flags(uuid) from public, anon, authenticated;

-- Senarai untuk skrin Proses Gaji (dengan sebab terkini jika ada)
create or replace function payroll_pcb_flags(p_run uuid)
returns table(employment_id uuid, employee_no text, name text, gross numeric, pcb numeric, annual_pcb numeric,
              missing_months int[], kinds text[], reason text, note text, reason_by text, reason_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,ceo,admin}') then raise exception 'Tidak dibenarkan'; end if;
  return query
  select f.employment_id, f.employee_no, f.name, f.gross, f.pcb, f.annual_pcb, f.missing_months, f.kinds,
         x.reason, x.note, coalesce(p.preferred_name, p.full_name), x.created_at
    from _pcb_flags(p_run) f
    left join lateral (select * from payroll_pcb_exceptions e where e.payroll_run_id = p_run and e.employment_id = f.employment_id
                        order by e.created_at desc limit 1) x on true
    left join persons p on p.id = x.created_by;
end $$;

create or replace function hr_pcb_exception_save(p_run uuid, p_employment uuid, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r payroll_runs; nota text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null or not has_role(r.company_id, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  if r.status not in ('draft','calculated','returned') then raise exception 'Gaji ini telah dihantar untuk kelulusan'; end if;
  if coalesce(p_reason, '') not in ('tp1','zakat','staf_baharu','bukan_pemastautin','lain') then raise exception 'Sila pilih sebab'; end if;
  if p_reason = 'lain' and (nota is null or length(nota) < 5) then raise exception 'Sila nyatakan sebab'; end if;
  if length(coalesce(nota, '')) > 500 then raise exception 'Nota terlalu panjang'; end if;
  if not exists (select 1 from payslips where payroll_run_id = p_run and employment_id = p_employment) then
    raise exception 'Pekerja tiada dalam gaji ini';
  end if;
  insert into payroll_pcb_exceptions(payroll_run_id, employment_id, reason, note, created_by)
  values (p_run, p_employment, p_reason, nota, current_person_id());
  -- Log audit platform: kod sebab sahaja (nota mungkin mengandungi maklumat peribadi)
  perform log_platform('payroll.pcb_exception', r.company_id, 'payroll_run', p_run,
                       jsonb_build_object('employment_id', p_employment, 'reason', p_reason));
end $$;

-- Sekat hantar / lulus selagi ada pekerja ditanda tanpa sebab
create or replace function trg_payroll_pcb_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status in ('pending','approved') and new.status is distinct from old.status then
    select count(*) into n from _pcb_flags(new.id) f
     where not exists (select 1 from payroll_pcb_exceptions x where x.payroll_run_id = new.id and x.employment_id = f.employment_id);
    if n > 0 then
      raise exception 'Semakan PCB belum selesai: % pekerja memerlukan sebab (PCB RM0 atau data terkumpul tiada). Isi sebab di Proses Gaji.', n;
    end if;
  end if;
  return new;
end $$;
create trigger payroll_runs_pcb_guard before update of status on payroll_runs
  for each row execute function trg_payroll_pcb_guard();

-- ---------- B. Notis PCB ----------
create or replace function _notify_hr_finance(p_company uuid, p_message text)
returns void language sql security definer set search_path = public as $$
  select notify_person(x.person_id, p_company, p_message)
    from (select distinct ur.person_id from user_roles ur
           join employments e on e.person_id = ur.person_id and e.company_id = ur.company_id and e.status in ('probation','active')
          where ur.company_id = p_company and ur.role in ('hr','finance')) x;
$$;
revoke execute on function _notify_hr_finance(uuid, text) from public, anon, authenticated;

create or replace function _pcb_notice_text(p_employment uuid) returns text
language sql stable security definer set search_path = public as $$
  select format('Perhatian: %s (%s) kini tertakluk kepada Potongan Cukai Bulanan (PCB) berdasarkan gaji terkini. '
                || 'Sila pastikan maklumat cukai (status perkahwinan, bilangan anak dan status pekerjaan pasangan) adalah lengkap sebelum payroll diproses.',
                coalesce(p.preferred_name, p.full_name), coalesce(e.employee_no, '-'))
    from employments e join persons p on p.id = e.person_id where e.id = p_employment;
$$;

-- Notis selepas gaji dikira: PCB RM0 bagi gaji yang tertakluk PCB (sekali bagi setiap pekerja bagi setiap gaji)
create or replace function trg_payroll_pcb_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare baru uuid[]; n int;
begin
  if new.status <> 'calculated' then return null; end if;
  select coalesce(array_agg(f.employment_id), '{}') into baru from _pcb_flags(new.id) f
   where 'pcb0' = any(f.kinds)
     and not exists (select 1 from payroll_pcb_alerts a where a.payroll_run_id = new.id and a.employment_id = f.employment_id)
     and not exists (select 1 from payroll_pcb_exceptions x where x.payroll_run_id = new.id and x.employment_id = f.employment_id);
  n := cardinality(baru);
  if n = 0 then return null; end if;
  insert into payroll_pcb_alerts(payroll_run_id, employment_id) select new.id, unnest(baru) on conflict do nothing;
  if n > 5 then
    perform _notify_hr_finance(new.company_id, format(
      'Perhatian: %s pekerja dikira PCB RM0 dalam gaji %s/%s walaupun gaji mereka tertakluk kepada Potongan Cukai Bulanan (PCB). '
      || 'Sila semak senarai di HRBoost → Penggajian sebelum gaji dihantar untuk kelulusan.', n, lpad(new.period_month::text, 2, '0'), new.period_year));
  else
    perform _notify_hr_finance(new.company_id, _pcb_notice_text(x)) from unnest(baru) x;
  end if;
  return null;
end $$;
create trigger payroll_runs_pcb_alert after update of status on payroll_runs
  for each row execute function trg_payroll_pcb_alert();

-- Status liabiliti PCB setiap pekerja (untuk mengesan peralihan RM0 → tertakluk)
create table pcb_liability_state (
  employment_id uuid primary key references employments(id) on delete cascade,
  liable        boolean not null,
  monthly_pcb   numeric(12,2) not null default 0,
  updated_at    timestamptz not null default now(),
  notified_at   timestamptz
);
alter table pcb_liability_state enable row level security;

-- PCB sebulan jika gaji tetap pada tarikh itu dibayar sepanjang tahun (unjuran Januari tanpa data terkumpul)
create or replace function _pcb_monthly_estimate(p_employment uuid, p_on date) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((pay_estimate(p_employment, coalesce((
           select jsonb_object_agg(pc.code, ec.amount)
             from employment_compensation ec join pay_components pc on pc.id = ec.component_id
            where ec.employment_id = p_employment and pay_component_is_fixed(pc.code)
              and ec.effective_from <= p_on and (ec.effective_to is null or ec.effective_to >= p_on)), '{}'),
           make_date(extract(year from p_on)::int, 1, 1)) ->> 'pcb')::numeric, 0);
$$;

create or replace function _pcb_liability_check(p_employment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e employments; d date; v numeric; lama pcb_liability_state; hantar boolean;
begin
  select * into e from employments where id = p_employment;
  if e.id is null or e.status not in ('probation','active') then return; end if;
  -- Gaji terkini (termasuk perubahan yang berkuat kuasa kemudian)
  d := greatest((now() at time zone 'Asia/Kuala_Lumpur')::date,
                coalesce((select max(effective_from) from employment_compensation where employment_id = p_employment), '1900-01-01'));
  v := _pcb_monthly_estimate(p_employment, d);
  select * into lama from pcb_liability_state where employment_id = p_employment;
  -- Notis hanya untuk tindakan pengguna / agent (bukan import data atau migrasi)
  hantar := v > 0 and (lama.employment_id is null or not lama.liable)
            and (current_person_id() is not null or is_service_role());
  insert into pcb_liability_state(employment_id, liable, monthly_pcb, updated_at, notified_at)
  values (p_employment, v > 0, v, now(), case when hantar then now() end)
  on conflict (employment_id) do update set liable = excluded.liable, monthly_pcb = excluded.monthly_pcb, updated_at = now(),
     notified_at = coalesce(excluded.notified_at, pcb_liability_state.notified_at);
  if hantar then
    perform _notify_hr_finance(e.company_id, _pcb_notice_text(p_employment));
    perform notify_person(e.person_id, e.company_id,
      'Gaji anda kini tertakluk kepada Potongan Cukai Bulanan (PCB). Sila semak maklumat cukai anda (status perkahwinan, bilangan anak dan status pekerjaan pasangan) di HRBoost → Saya → Profil. '
      || 'Jika anda mempunyai pelepasan cukai tambahan, sila kemukakan borang TP1 kepada HR.');
  end if;
end $$;
revoke execute on function _pcb_liability_check(uuid) from public, anon, authenticated;

-- Dinilai pada akhir transaksi (hr_set_pay / add_employee menyimpan beberapa item sekaligus)
create or replace function trg_comp_pcb_liability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _pcb_liability_check(new.employment_id);
  return null;
end $$;
create constraint trigger employment_compensation_pcb_liability
  after insert or update on employment_compensation deferrable initially deferred
  for each row execute function trg_comp_pcb_liability();

-- Keadaan awal bagi pekerja sedia ada (tiada notis dihantar)
insert into pcb_liability_state(employment_id, liable, monthly_pcb)
select e.id, v > 0, v
  from employments e cross join lateral (select _pcb_monthly_estimate(e.id, (now() at time zone 'Asia/Kuala_Lumpur')::date) v) z
 where e.status in ('probation','active')
on conflict do nothing;

insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Perhatian: (.+) \((\S+)\) kini tertakluk kepada Potongan Cukai Bulanan \(PCB\) berdasarkan gaji terkini\. Sila pastikan maklumat cukai \(status perkahwinan, bilangan anak dan status pekerjaan pasangan\) adalah lengkap sebelum payroll diproses\.$$q$,
              $q$Attention: \1 (\2) is now subject to Monthly Tax Deduction (PCB) based on the latest salary. Please make sure the tax details (marital status, number of children and spouse employment status) are complete before payroll is processed.$q$, 710, false),
  ('message', $q$^Perhatian: (\d+) pekerja dikira PCB RM0 dalam gaji (\S+) walaupun gaji mereka tertakluk kepada Potongan Cukai Bulanan \(PCB\)\. Sila semak senarai di HRBoost → Penggajian sebelum gaji dihantar untuk kelulusan\.$$q$,
              $q$Attention: \1 employees were calculated with RM0 PCB in the \2 payroll although their salary is subject to Monthly Tax Deduction (PCB). Please review the list in HRBoost → Payroll before the payroll is submitted for approval.$q$, 711, true),
  ('message', $q$^Gaji anda kini tertakluk kepada Potongan Cukai Bulanan \(PCB\)\. Sila semak maklumat cukai anda \(status perkahwinan, bilangan anak dan status pekerjaan pasangan\) di HRBoost → Saya → Profil\. Jika anda mempunyai pelepasan cukai tambahan, sila kemukakan borang TP1 kepada HR\.$$q$,
              $q$Your salary is now subject to Monthly Tax Deduction (PCB). Please check your tax details (marital status, number of children and spouse employment status) in HRBoost → Me → Profile. If you have additional tax reliefs, please submit the TP1 form to HR.$q$, 712, true);

-- ---------- C. Data cukai ----------
create or replace function hr_tax_data_gaps(p_company uuid)
returns table(employment_id uuid, employee_no text, name text, missing text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  return query
  select e.id, e.employee_no, coalesce(p.preferred_name, p.full_name),
         array_remove(array[
           case when p.marital_status is null then 'marital_status' end,
           case when p.marital_status in ('berkahwin','married') and p.spouse_working is null then 'spouse_working' end
         ], null)
    from employments e join persons p on p.id = e.person_id
   where e.company_id = p_company and e.status in ('probation','active')
     and (p.marital_status is null or (p.marital_status in ('berkahwin','married') and p.spouse_working is null))
   order by e.employee_no;
end $$;

create or replace function payroll_readiness(p_company uuid)
returns table(employment_id uuid, missing text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(p_company, '{hr,finance,admin}') then raise exception 'Hanya HR/Kewangan'; end if;
  return query
  select e.id, array_remove(array[
           case when p.ic_no is null and p.passport_no is null then 'no. KP / pasport' end,
           case when p.bank_account_no is null then 'akaun bank' end,
           case when e.epf_no is null and coalesce(s.epf_category, 'auto') <> 'none' then 'no. KWSP' end,
           case when not exists (select 1 from employment_compensation ec join pay_components pc on pc.id = ec.component_id
                                  where ec.employment_id = e.id and pc.code = 'BASIC' and (ec.effective_to is null or ec.effective_to >= current_date)) then 'gaji pokok' end,
           case when p.marital_status is null then 'status perkahwinan (PCB)' end,
           case when p.marital_status in ('berkahwin','married') and p.spouse_working is null then 'status pekerjaan pasangan (PCB)' end,
           case when coalesce(p.nationality, 'MY') not in ('MY', '') and p.passport_no is null then 'no. pasport' end
         ], null)
    from employments e join persons p on p.id = e.person_id left join employment_statutory s on s.employment_id = e.id
   where e.company_id = p_company and e.status in ('probation','active');
end $$;

create or replace function save_onboarding_step(p_employment uuid, p_step text, p_data jsonb default '{}')
returns int language plpgsql security definer set search_path = public as $$
declare e employments; me uuid := current_person_id(); d jsonb := coalesce(p_data, '{}'); v text;
begin
  select * into e from employments where id = p_employment;
  if me is null or e.id is null or e.person_id <> me then raise exception 'Bukan rekod anda'; end if;
  -- Selepas orientasi, nama penuh hanya diubah oleh HR dan akaun bank melalui request_bank_change.
  if p_step in ('name','bank') and exists (select 1 from onboarding_progress op
                                            where op.employment_id = e.id and op.step = p_step) then
    raise exception 'Langkah ini telah selesai. Sila buat perubahan melalui Profil';
  end if;

  if p_step = 'name' then
    if coalesce(trim(d->>'full_name'), '') = '' then raise exception 'Sila isi nama penuh'; end if;
    if coalesce(trim(d->>'preferred_name'), '') = '' then raise exception 'Sila isi nama panggilan'; end if;
    update persons set full_name = upper(trim(d->>'full_name')),
                       preferred_name = trim(d->>'preferred_name'), updated_at = now()
     where id = me;

  elsif p_step = 'selfie' then
    v := d->>'photo_path';
    if v is null or split_part(v, '/', 1) <> me::text then raise exception 'Gambar tidak sah'; end if;
    update persons set photo_path = v, updated_at = now() where id = me;

  elsif p_step = 'bank' then
    if coalesce(trim(d->>'bank_name'), '') = '' or coalesce(trim(d->>'bank_account_no'), '') = '' then
      raise exception 'Sila isi nama bank dan nombor akaun';
    end if;
    if coalesce(trim(d->>'contact_name'), '') = '' or coalesce(trim(d->>'contact_phone'), '') = '' then
      raise exception 'Sila isi nama dan nombor telefon waris';
    end if;
    update persons set bank_name = trim(d->>'bank_name'),
                       bank_account_no = regexp_replace(d->>'bank_account_no', '\s', '', 'g'), updated_at = now()
     where id = me;
    delete from emergency_contacts where person_id = me;
    insert into emergency_contacts(person_id, name, relationship, phone)
    values (me, trim(d->>'contact_name'), nullif(trim(d->>'contact_relationship'), ''), trim(d->>'contact_phone'));

  elsif p_step = 'ic' then
    if d->>'front_path' is null or split_part(d->>'front_path', '/', 1) <> me::text
       or d->>'back_path' is null or split_part(d->>'back_path', '/', 1) <> me::text then
      raise exception 'Sila ambil gambar hadapan dan belakang kad pengenalan';
    end if;
    delete from employee_documents where employment_id = e.id and doc_type in ('ic_front', 'ic_back');
    insert into employee_documents(employment_id, doc_type, title, storage_path, uploaded_by) values
      (e.id, 'ic_front', 'Kad pengenalan (hadapan)', d->>'front_path', me),
      (e.id, 'ic_back',  'Kad pengenalan (belakang)', d->>'back_path', me);

  elsif p_step = 'personal' then
    if coalesce(d->>'marital_status', '') not in ('bujang', 'berkahwin', 'duda_janda') then
      raise exception 'Sila pilih status perkahwinan';
    end if;
    -- Data cukai (PCB): status pekerjaan pasangan wajib bagi yang berkahwin; bilangan anak wajib (0 dibenarkan)
    if d->>'marital_status' = 'berkahwin' and nullif(d->>'spouse_working', '') is null then
      raise exception 'Sila nyatakan sama ada pasangan anda bekerja';
    end if;
    if nullif(d->>'children_count', '') is null or (d->>'children_count')::int < 0 then
      raise exception 'Sila nyatakan bilangan anak (0 jika tiada)';
    end if;
    update persons set address = nullif(trim(d->>'address'), ''),
                       marital_status = d->>'marital_status',
                       spouse_working = case when d->>'marital_status' = 'berkahwin'
                                             then (d->>'spouse_working')::boolean end,
                       children_count = greatest(0, coalesce((d->>'children_count')::int, 0)),
                       updated_at = now()
     where id = me;
    update employments set epf_no = nullif(trim(d->>'epf_no'), ''), tax_no = nullif(trim(d->>'tax_no'), '')
     where id = e.id;
    if coalesce((d->>'need_help')::boolean, false) then
      perform emit_event(e.company_id, 'onboarding.statutory_help', me, e.id, '{}');
    end if;

  elsif p_step not in ('handbook', 'install') then
    raise exception 'Langkah tidak dikenali';
  end if;

  return complete_onboarding_step(e.id, p_step);
end $$;

