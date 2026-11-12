-- =====================================================================
--  Jadual kerja mengikut hari (cth. Isnin–Jumaat 8:00–4:30, Sabtu 8:00–12:30 separuh hari, Ahad rehat).
--  companies.work_schedule: {"0".."6": {"start":"08:00","end":"16:30","half":false}}; hari tiada = hari rehat.
--  NULL = mod lama (weekend_days + work_start/work_end untuk semua hari bekerja).
--  Kesan: kiraan hari cuti & asas "hari bekerja" gaji (separuh hari = 0.5), lewat masuk ikut waktu masuk hari itu,
--  tarikh akhir SLA ikut waktu keluar hari itu.
-- =====================================================================

alter table companies add column if not exists work_schedule jsonb;

-- Waktu kerja syarikat pada satu tarikh (tiada baris = hari rehat mengikut jadual mingguan; cuti umum tidak dikira di sini)
create or replace function company_day_hours(p_company uuid, p_date date)
returns table(start_time time, end_time time, weight numeric)
language plpgsql stable security definer set search_path = public as $$
declare c companies; h jsonb;
begin
  select * into c from companies where id = p_company;
  if c.id is null then return; end if;
  if c.work_schedule is null then
    if extract(dow from p_date)::int = any(c.weekend_days) then return; end if;
    start_time := c.work_start; end_time := c.work_end; weight := 1; return next; return;
  end if;
  h := c.work_schedule -> extract(dow from p_date)::int::text;
  if h is null or jsonb_typeof(h) <> 'object' then return; end if;
  start_time := (h->>'start')::time; end_time := (h->>'end')::time;
  weight := case when coalesce((h->>'half')::boolean, false) then 0.5 else 1 end;
  return next;
end $$;

-- Pemberat hari bekerja (0 rehat/cuti umum, 0.5 separuh hari, 1 penuh)
create or replace function work_day_weight(p_company uuid, p_date date, p_state text default null) returns numeric
language sql stable security definer set search_path = public as $$
  select case when is_working_day(p_company, p_date, p_state)
              then coalesce((select weight from company_day_hours(p_company, p_date)), 1) else 0 end
$$;

-- HR / Pentadbir: simpan jadual mingguan. Juga menyelaraskan weekend_days, work_start & work_end (hari bekerja pertama).
create or replace function set_company_schedule(p_company uuid, p_schedule jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare h jsonb; i int; bersih jsonb := '{}'; rehat int[] := '{}'; mula time; tamat time; s time; e time;
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object' then raise exception 'Jadual kerja tidak sah'; end if;
  for i in 0..6 loop
    h := p_schedule -> i::text;
    if h is null or jsonb_typeof(h) <> 'object' then rehat := rehat || i; continue; end if;
    begin
      s := (h->>'start')::time; e := (h->>'end')::time;
    exception when others then raise exception 'Waktu kerja tidak sah'; end;
    if s is null or e is null or e <= s then raise exception 'Waktu keluar mesti selepas waktu masuk'; end if;
    bersih := bersih || jsonb_build_object(i::text, jsonb_build_object('start', to_char(s, 'HH24:MI'), 'end', to_char(e, 'HH24:MI'),
                                                                       'half', coalesce((h->>'half')::boolean, false)));
    if mula is null and i between 1 and 6 then mula := s; tamat := e; end if;
  end loop;
  if bersih = '{}'::jsonb then raise exception 'Sekurang-kurangnya satu hari bekerja diperlukan'; end if;
  if mula is null then mula := (bersih->'0'->>'start')::time; tamat := (bersih->'0'->>'end')::time; end if;
  update companies set work_schedule = bersih, weekend_days = rehat, work_start = mula, work_end = tamat where id = p_company;
  perform emit_event(p_company, 'settings.schedule_changed', current_person_id(), null, jsonb_build_object('schedule', bersih));
end $$;

-- Perubahan terus pada weekend_days / work_start / work_end (cth. langkah persediaan syarikat) tanpa jadual baharu
-- → kembali ke mod lama supaya tetapan tidak bercanggah
create or replace function trg_company_schedule_sync() returns trigger
language plpgsql as $$
begin
  if new.work_schedule is not distinct from old.work_schedule
     and (new.weekend_days is distinct from old.weekend_days or new.work_start is distinct from old.work_start
          or new.work_end is distinct from old.work_end) then
    new.work_schedule := null;
  end if;
  return new;
end $$;
drop trigger if exists company_schedule_sync on companies;
create trigger company_schedule_sync before update on companies for each row execute function trg_company_schedule_sync();

-- Kiraan hari cuti: separuh hari bekerja (cth. Sabtu) dikira 0.5
create or replace function leave_count_days(p_employment uuid, p_start date, p_end date, p_half leave_half)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v_company uuid; v_state text; d date; n numeric := 0;
begin
  select e.company_id, e.work_state into v_company, v_state from employments e where e.id = p_employment;
  d := p_start;
  while d <= p_end loop
    n := n + work_day_weight(v_company, d, v_state);
    d := d + 1;
  end loop;
  if p_half <> 'full' and n > 0 then n := least(n, 0.5); end if;
  return n;
end $$;

-- Asas "hari bekerja" gaji: separuh hari dikira 0.5
create or replace function company_working_days(p_company uuid, p_from date, p_to date) returns int
language sql stable security definer set search_path = public as $$
  select ceil(coalesce(sum(work_day_weight(p_company, d::date)), 0))::int from generate_series(p_from, p_to, interval '1 day') d
$$;

-- Lewat masuk: waktu masuk hari itu (pengecualian pekerja, jika ada, diutamakan)
create or replace function trg_attendance_late() returns trigger
language plpgsql security definer set search_path = public as $$
declare e employments; c companies; start_ts timestamptz; mula time;
begin
  if new.clock_in is null or new.source = 'correction' then return new; end if;
  select * into e from employments where id = new.employment_id;
  select * into c from companies where id = e.company_id;
  mula := coalesce(e.work_start, (select start_time from company_day_hours(c.id, new.work_date)), c.work_start);
  start_ts := (new.work_date + mula) at time zone c.timezone;
  new.late_minutes := greatest(0, floor(extract(epoch from (new.clock_in - start_ts)) / 60))::int;
  if new.late_minutes > c.late_grace_minutes
     and (tg_op = 'INSERT' or old.clock_in is distinct from new.clock_in) then
    perform emit_event(c.id, 'attendance.late', e.person_id, e.id,
      jsonb_build_object('work_date', new.work_date,
                         'clock_in', to_char(new.clock_in at time zone c.timezone, 'HH24:MI'),
                         'late_minutes', new.late_minutes,
                         'late_count_month', (select count(*) + 1 from attendance_records a
                            where a.employment_id = e.id and a.late_minutes > c.late_grace_minutes
                              and a.work_date <> new.work_date
                              and date_trunc('month', a.work_date) = date_trunc('month', new.work_date))));
  end if;
  return new;
end $$;

-- Tarikh akhir SLA: waktu keluar hari bekerja itu
create or replace function approval_sla_due(p_company uuid, p_wf approval_workflows, p_at timestamptz, p_exempt boolean)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare c companies; local_ts timestamp; d date; tamat time;
begin
  if p_exempt or p_wf.sla = 'none' then return null; end if;
  if p_wf.sla = 'hours' then return p_at + make_interval(hours => coalesce(p_wf.sla_hours, 24)); end if;
  select * into c from companies where id = p_company;
  local_ts := p_at at time zone c.timezone;
  d := local_ts::date;
  tamat := coalesce((select end_time from company_day_hours(p_company, d)), c.work_end);
  if local_ts::time > least(p_wf.cutoff_time, tamat) or not is_working_day(p_company, d) then
    d := next_working_day(p_company, d);
  end if;
  tamat := coalesce((select end_time from company_day_hours(p_company, d)), c.work_end);
  return (d + tamat) at time zone c.timezone;
end $$;

revoke all on function set_company_schedule(uuid, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function set_company_schedule(uuid, jsonb) from anon;
    grant execute on function set_company_schedule(uuid, jsonb) to authenticated;
  end if;
end $$;
