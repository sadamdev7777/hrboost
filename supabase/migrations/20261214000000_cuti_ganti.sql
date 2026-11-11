-- =====================================================================
--  Cuti ganti automatik (Akta Kerja 1955 s.60D(1)(b)):
--  jika cuti umum yang terpakai bagi syarikat jatuh pada hari rehat syarikat (companies.weekend_days),
--  hari bekerja berikutnya menjadi cuti umum ganti. Dikira secara dinamik — tiada data tambahan disimpan,
--  jadi pilihan cuti umum syarikat, negeri dan hari rehat sentiasa diambil kira.
--  Digunakan oleh pengiraan hari bekerja (cuti, gaji, OT), kalendar pasukan dan halaman cuti umum.
-- =====================================================================

-- Cuti umum yang terpakai bagi syarikat (tanpa semakan keahlian — untuk kegunaan dalaman)
create or replace function company_holiday_base(p_company uuid, p_from date, p_to date)
returns table(holiday_date date, name text)
language sql stable security definer set search_path = public as $$
  select h.holiday_date, min(h.name)
    from companies c join public_holidays h
      on h.holiday_date between p_from and p_to
     and (h.company_id is null or h.company_id = c.id)
     and (h.state is null or h.state = c.state)
     and ( h.is_mandatory or h.is_adhoc
           or not exists (select 1 from company_holiday_choices x
                           where x.company_id = c.id and x.year = extract(year from h.holiday_date)::int)
           or exists (select 1 from company_holiday_choices x
                       where x.company_id = c.id and x.holiday_id = h.id) )
   where c.id = p_company
   group by h.holiday_date
$$;

-- Cuti umum + cuti ganti dalam julat
create or replace function company_holidays_effective(p_company uuid, p_from date, p_to date)
returns table(holiday_date date, name text, is_replacement boolean, original_date date)
language plpgsql stable security definer set search_path = public as $$
declare rehat int[]; h record; d date; diguna date[] := '{}'; asas date[];
begin
  select weekend_days into rehat from companies where id = p_company;
  if rehat is null then return; end if;
  -- ambil 14 hari sebelum julat supaya cuti ganti yang jatuh dalam julat turut dikira
  select coalesce(array_agg(b.holiday_date), '{}') into asas from company_holiday_base(p_company, p_from - 14, p_to + 14) b;
  for h in select b.holiday_date, b.name from company_holiday_base(p_company, p_from - 14, p_to) b order by b.holiday_date loop
    if h.holiday_date between p_from and p_to then
      holiday_date := h.holiday_date; name := h.name; is_replacement := false; original_date := null; return next;
    end if;
    if extract(dow from h.holiday_date)::int = any(rehat) then
      d := h.holiday_date + 1;
      while extract(dow from d)::int = any(rehat) or d = any(asas) or d = any(diguna) loop d := d + 1; end loop;
      diguna := diguna || d;
      if d between p_from and p_to then
        holiday_date := d; name := 'Cuti ganti: ' || h.name; is_replacement := true; original_date := h.holiday_date; return next;
      end if;
    end if;
  end loop;
end $$;

create or replace function is_working_day(p_company uuid, p_date date, p_state text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not (extract(dow from p_date)::int = any(c.weekend_days))
     and not exists (
       select 1 from public_holidays h
       where h.holiday_date = p_date
         and (h.company_id is null or h.company_id = c.id)
         and (h.state is null or h.state = coalesce(p_state, c.state))
         and ( h.is_mandatory or h.is_adhoc
               or not exists (select 1 from company_holiday_choices x
                               where x.company_id = c.id and x.year = extract(year from p_date)::int)
               or exists (select 1 from company_holiday_choices x
                           where x.company_id = c.id and x.holiday_id = h.id) ))
     and (p_state is not null and p_state <> c.state
          or not exists (select 1 from company_holidays_effective(c.id, p_date, p_date) g where g.is_replacement))
  from companies c where c.id = p_company
$$;

-- Paparan (kalendar pasukan, kehadiran): cuti umum termasuk cuti ganti
create or replace function company_holidays(p_company uuid, p_from date, p_to date)
returns table(holiday_date date, name text)
language sql stable security definer set search_path = public as $$
  select g.holiday_date, g.name from company_holidays_effective(p_company, p_from, p_to) g
   where is_company_member(p_company)
   order by g.holiday_date
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function company_holiday_base(uuid, date, date) from public, anon, authenticated;
    revoke all on function company_holidays_effective(uuid, date, date) from public, anon, authenticated;
  end if;
end $$;
