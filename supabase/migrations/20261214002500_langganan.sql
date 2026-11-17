-- =====================================================================
--  Langganan HRBoost: RM499 setahun bagi setiap syarikat, percubaan percuma 5 hari, bayaran CHIP,
--  invois & resit atas nama HRBoost, kempen (diskaun ikut tempoh) dan kod baucar dengan had bilangan syarikat.
--  Syarikat sedia ada dikecualikan. Tamat tanpa bayaran: tangguh 14 hari, kemudian baca sahaja (data kekal).
-- =====================================================================

-- ---------------------------------------------------------------- Tetapan (Pentadbir Platform)
insert into platform_settings(key, value) values
  ('billing', jsonb_build_object(
     'price_sen', 49900, 'currency', 'MYR', 'trial_days', 5, 'grace_days', 14, 'sst_rate', 0,
     'seller', jsonb_build_object('name', 'HRBoost', 'ssm', '', 'address', '', 'email', '', 'phone', '')))
on conflict (key) do nothing;

create or replace function billing_setting() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from platform_settings where key = 'billing'), '{}'::jsonb)
$$;

-- ---------------------------------------------------------------- Status langganan syarikat
alter table companies add column if not exists billing_status text not null default 'trial'
  check (billing_status in ('trial','active','grace','readonly','exempt'));
alter table companies add column if not exists trial_ends_at timestamptz;
alter table companies add column if not exists paid_until timestamptz;
alter table companies add column if not exists billing_notified jsonb not null default '{}'::jsonb;

-- Syarikat sedia ada: dikecualikan
update companies set billing_status = 'exempt' where billing_status = 'trial' and trial_ends_at is null;

-- Syarikat baharu: percubaan percuma (hari ikut tetapan)
create or replace function trg_company_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.billing_status = 'trial' and new.trial_ends_at is null then
    new.trial_ends_at := now() + make_interval(days => coalesce((billing_setting()->>'trial_days')::int, 5));
  end if;
  return new;
end $$;
drop trigger if exists company_trial on companies;
create trigger company_trial before insert on companies for each row execute function trg_company_trial();

-- ---------------------------------------------------------------- Baucar & kempen
create table if not exists billing_vouchers (
  id               uuid primary key default gen_random_uuid(),
  code             text unique,                 -- null = kempen automatik (tanpa kod) dalam tempoh
  name             text not null,
  kind             text not null check (kind in ('percent','fixed')),
  value            numeric(12,2) not null check (value > 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  max_redemptions  int check (max_redemptions is null or max_redemptions > 0),
  active           boolean not null default true,
  note             text,
  created_by       uuid references persons(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
alter table billing_vouchers enable row level security;

-- ---------------------------------------------------------------- Invois & resit
create sequence if not exists billing_invoice_seq;
create sequence if not exists billing_receipt_seq;

create table if not exists billing_invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  company_id       uuid not null references companies(id) on delete cascade,
  description      text not null,
  period_start     date,
  period_end       date,
  subtotal_sen     int not null,
  discount_sen     int not null default 0,
  total_sen        int not null,
  voucher_id       uuid references billing_vouchers(id) on delete set null,
  voucher_label    text,
  status           text not null default 'pending' check (status in ('pending','paid','cancelled')),
  chip_purchase_id text unique,
  checkout_url     text,
  payment_method   text,
  paid_at          timestamptz,
  receipt_number   text unique,
  buyer            jsonb not null default '{}'::jsonb,
  seller           jsonb not null default '{}'::jsonb,
  payer_person_id  uuid references persons(id) on delete set null,
  payer_name       text,
  payer_email      text,
  created_at       timestamptz not null default now()
);
create index if not exists billing_invoices_company_idx on billing_invoices(company_id, created_at desc);
alter table billing_invoices enable row level security;

create table if not exists billing_redemptions (
  voucher_id  uuid not null references billing_vouchers(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  invoice_id  uuid not null references billing_invoices(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (voucher_id, company_id)
);
alter table billing_redemptions enable row level security;

-- ---------------------------------------------------------------- Status (semua ahli syarikat)
-- readonly = tidak boleh membuat permohonan / gaji baharu; data kekal boleh dibaca
create or replace function billing_status(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c companies; tamat timestamptz; s jsonb := billing_setting();
begin
  if not (is_company_member(p_company) or is_superadmin()) then raise exception 'Tidak dibenarkan'; end if;
  select * into c from companies where id = p_company;
  tamat := case c.billing_status when 'trial' then c.trial_ends_at when 'exempt' then null else coalesce(c.paid_until, c.trial_ends_at) end;
  return jsonb_build_object(
    'status', c.billing_status,
    'ends_at', tamat,
    'trial_ends_at', c.trial_ends_at,
    'paid_until', c.paid_until,
    'days_left', case when tamat is null then null else ceil(extract(epoch from (tamat - now())) / 86400)::int end,
    'readonly_at', case when c.billing_status in ('trial','active','grace') and tamat is not null
                        then tamat + make_interval(days => coalesce((s->>'grace_days')::int, 14)) end,
    'price_sen', coalesce((s->>'price_sen')::int, 49900),
    'can_pay', has_role(p_company, '{admin,hr,ceo,finance}'));
end $$;

-- Syarikat boleh membuat transaksi baharu?
create or replace function billing_writable(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select billing_status <> 'readonly' from companies where id = p_company), true)
$$;

-- Permohonan baharu (cuti, tuntutan, gaji, ...) disekat apabila langganan dalam mod baca sahaja
create or replace function trg_billing_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not billing_writable(new.company_id) then
    raise exception 'Langganan syarikat telah tamat. Sila hubungi Pentadbir syarikat untuk memperbaharui langganan.';
  end if;
  return new;
end $$;
drop trigger if exists approval_billing_guard on approval_requests;
create trigger approval_billing_guard before insert on approval_requests for each row execute function trg_billing_guard();

-- ---------------------------------------------------------------- Sebut harga (dengan baucar / kempen)
create or replace function _billing_voucher_ok(v billing_vouchers, p_company uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not v.active then 'Kod ini tidak aktif'
    when v.starts_at is not null and now() < v.starts_at then 'Kod ini belum boleh digunakan'
    when v.ends_at is not null and now() > v.ends_at then 'Kod ini telah tamat tempoh'
    when exists (select 1 from billing_redemptions r where r.voucher_id = v.id and r.company_id = p_company) then 'Syarikat anda telah menggunakan kod ini'
    when v.max_redemptions is not null and (select count(*) from billing_redemptions r where r.voucher_id = v.id) >= v.max_redemptions then 'Had penggunaan kod ini telah penuh'
  end
$$;

create or replace function _billing_discount(v billing_vouchers, p_price int) returns int
language sql immutable as $$
  select least(p_price, case when v.kind = 'percent' then round(p_price * v.value / 100) else round(v.value * 100) end)::int
$$;

create or replace function billing_quote(p_company uuid, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  harga int := coalesce((billing_setting()->>'price_sen')::int, 49900);
  kod text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v billing_vouchers; terbaik billing_vouchers; diskaun int := 0; d int; ralat text; sebab text;
begin
  if not has_role(p_company, '{admin,hr,ceo,finance}') then raise exception 'Hanya Pentadbir, HR, CEO atau Kewangan'; end if;
  -- Kempen automatik (tanpa kod) dalam tempoh & belum penuh
  for v in select * from billing_vouchers where code is null loop
    if _billing_voucher_ok(v, p_company) is null then
      d := _billing_discount(v, harga);
      if d > diskaun then diskaun := d; terbaik := v; end if;
    end if;
  end loop;
  -- Kod baucar
  if kod is not null then
    select * into v from billing_vouchers where upper(code) = kod;
    if v.id is null then
      ralat := 'Kod baucar tidak sah';
    else
      sebab := _billing_voucher_ok(v, p_company);
      if sebab is not null then ralat := sebab;
      else
        d := _billing_discount(v, harga);
        if d >= diskaun then diskaun := d; terbaik := v; end if;
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'price_sen', harga, 'discount_sen', diskaun, 'total_sen', harga - diskaun,
    'voucher_id', terbaik.id, 'voucher_name', terbaik.name, 'voucher_code', terbaik.code,
    'voucher_kind', terbaik.kind, 'voucher_value', terbaik.value, 'code_error', ralat);
end $$;

-- ---------------------------------------------------------------- Invois
create or replace function billing_create_invoice(p_company uuid, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q jsonb; c companies; s jsonb := billing_setting(); mula date; tamat date; inv billing_invoices; p persons;
begin
  if not has_role(p_company, '{admin,hr,ceo,finance}') then raise exception 'Hanya Pentadbir, HR, CEO atau Kewangan'; end if;
  select * into c from companies where id = p_company;
  if c.billing_status = 'exempt' then raise exception 'Syarikat ini dikecualikan daripada yuran langganan'; end if;
  q := billing_quote(p_company, p_code);
  if q->>'code_error' is not null and nullif(btrim(coalesce(p_code, '')), '') is not null then raise exception '%', q->>'code_error'; end if;
  select * into p from persons where id = current_person_id();
  -- Tempoh baharu bermula selepas tempoh berbayar semasa (pembaharuan awal tidak menghilangkan hari)
  mula := greatest((now() at time zone 'Asia/Kuala_Lumpur')::date, coalesce((c.paid_until at time zone 'Asia/Kuala_Lumpur')::date, '1900-01-01'::date));
  tamat := (mula + interval '1 year' - interval '1 day')::date;
  update billing_invoices set status = 'cancelled' where company_id = p_company and status = 'pending';
  insert into billing_invoices(number, company_id, description, period_start, period_end, subtotal_sen, discount_sen, total_sen,
                               voucher_id, voucher_label, buyer, seller, payer_person_id, payer_name, payer_email)
  values ('HRB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('billing_invoice_seq')::text, 5, '0'), p_company,
          'Langganan HRBoost 1 tahun', mula, tamat,
          (q->>'price_sen')::int, (q->>'discount_sen')::int, (q->>'total_sen')::int,
          (q->>'voucher_id')::uuid, coalesce(q->>'voucher_code', q->>'voucher_name'),
          jsonb_build_object('name', c.name, 'reg_no', c.reg_no, 'address', c.address, 'code', c.code),
          coalesce(s->'seller', '{}'::jsonb), p.id, coalesce(p.full_name, p.preferred_name), p.email)
  returning * into inv;
  return to_jsonb(inv) - 'seller';
end $$;

-- Edge Function (service role): simpan ID pembelian CHIP & pautan bayaran
create or replace function billing_set_checkout(p_invoice uuid, p_purchase text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  update billing_invoices set chip_purchase_id = p_purchase, checkout_url = p_url where id = p_invoice and status = 'pending';
end $$;

-- Edge Function (service role): bayaran disahkan oleh CHIP. Idempotent.
create or replace function billing_mark_paid(p_invoice uuid, p_purchase text, p_method text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv billing_invoices; c companies; hingga timestamptz; r record;
begin
  if not is_service_role() then raise exception 'Tidak dibenarkan'; end if;
  select * into inv from billing_invoices where id = p_invoice for update;
  if inv.id is null then raise exception 'Invois tidak dijumpai'; end if;
  if inv.status = 'paid' then return jsonb_build_object('already', true, 'receipt', inv.receipt_number); end if;
  if inv.chip_purchase_id is not null and p_purchase is not null and inv.chip_purchase_id <> p_purchase then
    raise exception 'ID pembelian tidak sepadan dengan invois';
  end if;
  select * into c from companies where id = inv.company_id for update;
  hingga := ((inv.period_end + 1)::timestamp at time zone 'Asia/Kuala_Lumpur');
  update billing_invoices set status = 'paid', paid_at = now(), chip_purchase_id = coalesce(p_purchase, chip_purchase_id),
         payment_method = p_method,
         receipt_number = 'HRB-R-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('billing_receipt_seq')::text, 5, '0')
   where id = inv.id returning * into inv;
  update companies set billing_status = 'active', paid_until = greatest(coalesce(paid_until, now()), hingga), billing_notified = '{}'::jsonb
   where id = inv.company_id;
  if inv.voucher_id is not null then
    insert into billing_redemptions(voucher_id, company_id, invoice_id) values (inv.voucher_id, inv.company_id, inv.id)
    on conflict do nothing;
  end if;
  -- Maklumkan pembayar & Pentadbir syarikat
  for r in select distinct x.pid from (
             select inv.payer_person_id pid
             union select ur.person_id from user_roles ur where ur.company_id = inv.company_id and ur.role = 'admin') x
           where x.pid is not null loop
    perform notify_person(r.pid, inv.company_id,
      'Terima kasih. Bayaran langganan HRBoost RM' || to_char(inv.total_sen / 100.0, 'FM999990.00') || ' telah diterima (resit ' ||
      inv.receipt_number || '). Langganan aktif sehingga ' || to_char(inv.period_end, 'DD/MM/YYYY') || '. Resit di HRBoost → Tetapan → Langganan.');
  end loop;
  perform log_platform('billing.paid', inv.company_id, 'billing_invoice', inv.id,
                       jsonb_build_object('total_sen', inv.total_sen, 'voucher', inv.voucher_label));
  return jsonb_build_object('already', false, 'receipt', inv.receipt_number);
end $$;

-- Edge Function (service role): butiran invois untuk CHIP
create or replace function billing_invoice_for_checkout(p_invoice uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_service_role() then to_jsonb(i) end from billing_invoices i where i.id = p_invoice
$$;

-- Senarai & paparan (ahli syarikat yang boleh membayar; Pentadbir Platform)
create or replace function billing_invoices_list(p_company uuid) returns setof billing_invoices
language plpgsql stable security definer set search_path = public as $$
begin
  if not (has_role(p_company, '{admin,hr,ceo,finance}') or is_superadmin()) then raise exception 'Tidak dibenarkan'; end if;
  return query select * from billing_invoices where company_id = p_company and status <> 'cancelled' order by created_at desc;
end $$;

create or replace function billing_invoice_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i billing_invoices;
begin
  select * into i from billing_invoices where id = p_id;
  if i.id is null or not (has_role(i.company_id, '{admin,hr,ceo,finance}') or is_superadmin()) then raise exception 'Tidak dibenarkan'; end if;
  return to_jsonb(i);
end $$;

-- ---------------------------------------------------------------- Peralihan harian & peringatan (pg_cron)
create or replace function billing_tick() returns int
language plpgsql security definer set search_path = public as $$
declare
  c companies; s jsonb := billing_setting(); tangguh int := coalesce((s->>'grace_days')::int, 14);
  tamat timestamptz; hari int; kunci text; n int := 0; r record; mesej text;
begin
  for c in select * from companies where status = 'active' and billing_status in ('trial','active','grace') loop
    tamat := case when c.billing_status = 'trial' or c.paid_until is null then c.trial_ends_at else c.paid_until end;
    if tamat is null then continue; end if;
    hari := ceil(extract(epoch from (tamat - now())) / 86400)::int;
    -- Peralihan
    if now() >= tamat + make_interval(days => tangguh) then
      update companies set billing_status = 'readonly' where id = c.id;
      kunci := 'readonly'; mesej := 'Langganan HRBoost syarikat anda telah tamat. Sistem kini dalam mod baca sahaja sehingga langganan diperbaharui di HRBoost → Tetapan → Langganan.';
    elsif now() >= tamat and c.billing_status <> 'grace' then
      update companies set billing_status = 'grace' where id = c.id;
      kunci := 'grace'; mesej := 'Langganan HRBoost syarikat anda telah tamat. Sila bayar dalam ' || tangguh || ' hari untuk terus menggunakan semua ciri. Bayar di HRBoost → Tetapan → Langganan.';
    elsif c.billing_status = 'trial' and hari in (2, 1) then
      kunci := 'trial_' || hari; mesej := 'Percubaan percuma HRBoost syarikat anda tamat dalam ' || hari || ' hari. Langgan RM' || to_char(coalesce((s->>'price_sen')::int, 49900) / 100.0, 'FM999990') || ' setahun di HRBoost → Tetapan → Langganan.';
    elsif c.billing_status = 'active' and hari in (30, 7, 1) then
      kunci := 'renew_' || hari; mesej := 'Langganan HRBoost syarikat anda tamat dalam ' || hari || ' hari. Perbaharui di HRBoost → Tetapan → Langganan.';
    else
      continue;
    end if;
    if c.billing_notified ? kunci then continue; end if;
    update companies set billing_notified = billing_notified || jsonb_build_object(kunci, now()) where id = c.id;
    for r in select distinct ur.person_id from user_roles ur
              join employments e on e.person_id = ur.person_id and e.company_id = c.id and e.status in ('probation','active')
             where ur.company_id = c.id and ur.role in ('admin','ceo','finance') loop
      perform notify_person(r.person_id, c.id, mesej);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hrboost-billing-tick';
    perform cron.schedule('hrboost-billing-tick', '13 1 * * *', 'select public.billing_tick()');  -- 9:13 pagi MYT
  end if;
end $$;

-- ---------------------------------------------------------------- Pentadbir Platform
create or replace function sa_billing_overview() returns table(company_id uuid, code text, name text, billing_status text,
  trial_ends_at timestamptz, paid_until timestamptz, created_at timestamptz, paid_total_sen bigint, last_paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.code, c.name, c.billing_status, c.trial_ends_at, c.paid_until, c.created_at,
         coalesce((select sum(i.total_sen) from billing_invoices i where i.company_id = c.id and i.status = 'paid'), 0),
         (select max(i.paid_at) from billing_invoices i where i.company_id = c.id and i.status = 'paid')
    from companies c where is_superadmin() order by c.created_at desc
$$;

create or replace function sa_billing_set(p_company uuid, p_status text, p_until timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if p_status not in ('trial','active','grace','readonly','exempt') then raise exception 'Status tidak sah'; end if;
  update companies set billing_status = p_status,
         paid_until = case when p_status = 'active' then coalesce(p_until, paid_until) else paid_until end,
         trial_ends_at = case when p_status = 'trial' then coalesce(p_until, trial_ends_at) else trial_ends_at end,
         billing_notified = '{}'::jsonb
   where id = p_company;
  perform log_platform('billing.set', p_company, 'company', p_company, jsonb_build_object('status', p_status, 'until', p_until));
end $$;

create or replace function sa_vouchers() returns table(id uuid, code text, name text, kind text, value numeric, starts_at timestamptz,
  ends_at timestamptz, max_redemptions int, active boolean, note text, used int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.code, v.name, v.kind, v.value, v.starts_at, v.ends_at, v.max_redemptions, v.active, v.note,
         (select count(*)::int from billing_redemptions r where r.voucher_id = v.id), v.created_at
    from billing_vouchers v where is_superadmin() order by v.created_at desc
$$;

create or replace function sa_voucher_save(p_data jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare vid uuid; kod text := nullif(upper(btrim(coalesce(p_data->>'code', ''))), '');
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if kod is not null and kod !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'Kod baucar hanya huruf, nombor, - atau _ (3–30 aksara)'; end if;
  if coalesce(btrim(p_data->>'name'), '') = '' then raise exception 'Sila isi nama kempen'; end if;
  if p_id is null then
    insert into billing_vouchers(code, name, kind, value, starts_at, ends_at, max_redemptions, active, note, created_by)
    values (kod, btrim(p_data->>'name'), p_data->>'kind', (p_data->>'value')::numeric,
            nullif(p_data->>'starts_at', '')::timestamptz, nullif(p_data->>'ends_at', '')::timestamptz,
            nullif(p_data->>'max_redemptions', '')::int, coalesce((p_data->>'active')::boolean, true), p_data->>'note', current_person_id())
    returning id into vid;
  else
    update billing_vouchers set code = kod, name = btrim(p_data->>'name'), kind = p_data->>'kind', value = (p_data->>'value')::numeric,
           starts_at = nullif(p_data->>'starts_at', '')::timestamptz, ends_at = nullif(p_data->>'ends_at', '')::timestamptz,
           max_redemptions = nullif(p_data->>'max_redemptions', '')::int, active = coalesce((p_data->>'active')::boolean, true),
           note = p_data->>'note'
     where id = p_id returning id into vid;
  end if;
  perform log_platform('billing.voucher_save', null, 'billing_voucher', vid, p_data);
  return vid;
exception when unique_violation then raise exception 'Kod baucar ini sudah wujud';
end $$;

create or replace function sa_billing_invoices(p_limit int default 200) returns table(id uuid, number text, company_name text,
  total_sen int, discount_sen int, voucher_label text, status text, paid_at timestamptz, receipt_number text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.number, c.name, i.total_sen, i.discount_sen, i.voucher_label, i.status, i.paid_at, i.receipt_number, i.created_at
    from billing_invoices i join companies c on c.id = i.company_id
   where is_superadmin() and i.status <> 'cancelled' order by i.created_at desc limit p_limit
$$;

create or replace function sa_billing_settings_set(p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s jsonb := billing_setting();
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if (p_data->>'price_sen')::int < 0 or (p_data->>'trial_days')::int < 0 or (p_data->>'grace_days')::int < 0 then raise exception 'Nilai tidak sah'; end if;
  s := s || jsonb_strip_nulls(jsonb_build_object(
         'price_sen', (p_data->>'price_sen')::int, 'trial_days', (p_data->>'trial_days')::int,
         'grace_days', (p_data->>'grace_days')::int, 'seller', p_data->'seller'));
  insert into platform_settings(key, value) values ('billing', s) on conflict (key) do update set value = excluded.value;
  perform log_platform('billing.settings', null, 'platform_setting', null, p_data);
end $$;

create or replace function sa_billing_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_superadmin() then billing_setting() end
$$;

-- Kunci CHIP dalam Vault (sama seperti kunci Resend)
create or replace function sa_platform_secret_set(p_name text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid; nilai text := trim(coalesce(p_value, ''));
begin
  if not is_superadmin() then raise exception 'Hanya superadmin'; end if;
  if p_name not in ('resend_api_key', 'chip_secret_key', 'chip_brand_id') then raise exception 'Rahsia tidak dikenali'; end if;
  if p_name = 'resend_api_key' and nilai !~ '^re_[A-Za-z0-9_]{16,}$' then
    raise exception 'Kunci Resend tidak sah (mesti bermula dengan re_)';
  end if;
  if p_name in ('chip_secret_key', 'chip_brand_id') and length(nilai) < 8 then raise exception 'Nilai CHIP tidak sah'; end if;
  select vault_id into v from platform_secrets where name = p_name;
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if v is null then
      execute 'select vault.create_secret($1, $2)' into v using nilai, 'hrboost:platform:' || p_name;
    else
      execute 'select vault.update_secret($1, $2)' using v, nilai;
    end if;
    insert into platform_secrets(name, vault_id, secret, hint, updated_by, updated_at)
    values (p_name, v, null, right(nilai, 4), current_person_id(), now())
    on conflict (name) do update set vault_id = excluded.vault_id, secret = null, hint = excluded.hint,
                                     updated_by = excluded.updated_by, updated_at = now();
  else
    insert into platform_secrets(name, secret, hint, updated_by, updated_at)
    values (p_name, nilai, right(nilai, 4), current_person_id(), now())
    on conflict (name) do update set secret = excluded.secret, hint = excluded.hint, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform log_platform('platform.secret_set', null, 'platform_secret', null, jsonb_build_object('name', p_name));
end $$;

create or replace function sa_platform_secrets() returns table(name text, is_set boolean, hint text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n, s.name is not null, s.hint, s.updated_at
    from unnest(array['resend_api_key', 'chip_secret_key', 'chip_brand_id']) n left join platform_secrets s on s.name = n
   where is_superadmin()
$$;

-- ---------------------------------------------------------------- Terjemahan mesej
insert into message_i18n(kind, ms, en, sort, frasa) values
  ('message', $q$^Terima kasih\. Bayaran langganan HRBoost RM(\S+) telah diterima \(resit (\S+)\)\. Langganan aktif sehingga (\S+)\. Resit di HRBoost → Tetapan → Langganan\.$$q$,
              $q$Thank you. Your HRBoost subscription payment of RM\1 has been received (receipt \2). The subscription is active until \3. Receipts are in HRBoost → Settings → Subscription.$q$, 700, true),
  ('message', $q$^Langganan HRBoost syarikat anda telah tamat\. Sistem kini dalam mod baca sahaja sehingga langganan diperbaharui di HRBoost → Tetapan → Langganan\.$$q$,
              $q$Your company's HRBoost subscription has ended. The system is now read-only until the subscription is renewed in HRBoost → Settings → Subscription.$q$, 701, true),
  ('message', $q$^Langganan HRBoost syarikat anda telah tamat\. Sila bayar dalam (\d+) hari untuk terus menggunakan semua ciri\. Bayar di HRBoost → Tetapan → Langganan\.$$q$,
              $q$Your company's HRBoost subscription has ended. Please pay within \1 days to keep using all features. Pay in HRBoost → Settings → Subscription.$q$, 702, true),
  ('message', $q$^Percubaan percuma HRBoost syarikat anda tamat dalam (\d+) hari\. Langgan RM(\S+) setahun di HRBoost → Tetapan → Langganan\.$$q$,
              $q$Your company's free HRBoost trial ends in \1 days. Subscribe for RM\2 a year in HRBoost → Settings → Subscription.$q$, 703, true),
  ('message', $q$^Langganan HRBoost syarikat anda tamat dalam (\d+) hari\. Perbaharui di HRBoost → Tetapan → Langganan\.$$q$,
              $q$Your company's HRBoost subscription ends in \1 days. Renew it in HRBoost → Settings → Subscription.$q$, 704, true)
on conflict (kind, ms) do nothing;

-- ---------------------------------------------------------------- Kebenaran
do $$
declare f text;
begin
  foreach f in array array['billing_setting()', '_billing_voucher_ok(billing_vouchers,uuid)',
                           '_billing_discount(billing_vouchers,integer)', 'billing_set_checkout(uuid,text,text)',
                           'billing_mark_paid(uuid,text,text)', 'billing_invoice_for_checkout(uuid)', 'billing_tick()'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon, authenticated';
      execute 'grant execute on function ' || f || ' to service_role';
    end if;
  end loop;
  foreach f in array array['billing_status(uuid)', 'billing_writable(uuid)', 'billing_quote(uuid,text)', 'billing_create_invoice(uuid,text)',
                           'billing_invoices_list(uuid)', 'billing_invoice_view(uuid)', 'sa_billing_overview()', 'sa_billing_set(uuid,text,timestamptz)',
                           'sa_vouchers()', 'sa_voucher_save(jsonb,uuid)', 'sa_billing_invoices(integer)', 'sa_billing_settings_set(jsonb)',
                           'sa_billing_settings()', 'sa_platform_secret_set(text,text)', 'sa_platform_secrets()'] loop
    execute 'revoke all on function ' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on function ' || f || ' from anon';
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $$;
