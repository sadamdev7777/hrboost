-- =====================================================================
--  Pembantu AI, bacaan resit / kad pengenalan, pengetahuan AI (T_PengetahuanAI)
--  Carian dokumen menggunakan carian teks penuh Postgres (tiada embedding diperlukan).
--  Panggilan model hanya dalam Edge Function (kunci API dalam Supabase secrets).
-- =====================================================================

alter table ai_knowledge_chunks add column if not exists chunk_no int not null default 0;
alter table ai_knowledge_chunks add column if not exists tsv tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;
create index if not exists ai_knowledge_chunks_tsv on ai_knowledge_chunks using gin (tsv);
alter table ai_knowledge_docs add column if not exists chars int not null default 0;

-- Soalan pekerja yang tidak dapat dijawab (dipaparkan kepada HR)
create table if not exists ai_unanswered (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references companies(id) on delete cascade,
  person_id   uuid references persons(id) on delete set null,
  question    text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table ai_unanswered enable row level security;
drop policy if exists read_hr on ai_unanswered;
create policy read_hr on ai_unanswered for select using (has_role(company_id, '{hr,admin}'));

-- ---------------------------------------------------------------------
-- Simpan dokumen pengetahuan: pecah kepada perenggan (~1,200 aksara)
-- ---------------------------------------------------------------------
create or replace function kb_save_document(p_company uuid, p_title text, p_text text, p_doc uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare d uuid := p_doc; para text; buf text := ''; n int := 0; t text := replace(coalesce(p_text, ''), E'\r', '');
begin
  if not has_role(p_company, '{hr,admin}') then raise exception 'Hanya HR/Pentadbir'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Sila isi tajuk dokumen'; end if;
  if length(trim(t)) < 20 then raise exception 'Kandungan dokumen terlalu pendek'; end if;
  if length(t) > 400000 then raise exception 'Dokumen terlalu panjang (maksimum 400,000 aksara)'; end if;
  if d is null then
    insert into ai_knowledge_docs(company_id, title, chars) values (p_company, trim(p_title), length(t)) returning id into d;
  else
    if not exists (select 1 from ai_knowledge_docs where id = d and company_id = p_company) then raise exception 'Dokumen tidak dijumpai'; end if;
    update ai_knowledge_docs set title = trim(p_title), chars = length(t), updated_at = now() where id = d;
    delete from ai_knowledge_chunks where doc_id = d;
  end if;
  foreach para in array regexp_split_to_array(t, E'\n\\s*\n') loop
    para := trim(para);
    continue when para = '';
    if length(buf) + length(para) > 1200 and buf <> '' then
      n := n + 1;
      insert into ai_knowledge_chunks(doc_id, content, chunk_no) values (d, buf, n);
      buf := '';
    end if;
    buf := case when buf = '' then para else buf || E'\n\n' || para end;
    -- perenggan yang sangat panjang dipecah terus
    while length(buf) > 2400 loop
      n := n + 1;
      insert into ai_knowledge_chunks(doc_id, content, chunk_no) values (d, left(buf, 1200), n);
      buf := substr(buf, 1201);
    end loop;
  end loop;
  if buf <> '' then
    n := n + 1;
    insert into ai_knowledge_chunks(doc_id, content, chunk_no) values (d, buf, n);
  end if;
  perform emit_event(p_company, 'settings.knowledge_updated', current_person_id(), null, jsonb_build_object('doc', d, 'chunks', n));
  return d;
end $$;

-- Senarai dokumen (T_PengetahuanAI)
create or replace function kb_documents(p_company uuid)
returns table(id uuid, title text, active boolean, chars int, chunks bigint, updated_at timestamptz, global boolean)
language sql stable security definer set search_path = public as $$
  select d.id, d.title, d.active, d.chars, (select count(*) from ai_knowledge_chunks c where c.doc_id = d.id), d.updated_at, d.company_id is null
    from ai_knowledge_docs d
   where (d.company_id = p_company or d.company_id is null) and has_role(p_company, '{hr,admin}')
   order by d.company_id is null, d.updated_at desc
$$;

-- Carian petikan polisi untuk syarikat (dokumen syarikat + dokumen platform)
create or replace function kb_search(p_company uuid, p_query text, p_limit int default 5)
returns table(title text, content text, rank real)
language plpgsql stable security definer set search_path = public as $$
declare q tsquery;
begin
  if not (is_company_member(p_company) or is_service_role()) then raise exception 'Tidak dibenarkan'; end if;
  -- OR antara kata kunci (soalan pekerja jarang sepadan semua perkataan)
  select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' | '))
    into q
    from (select distinct lower(w) w from regexp_split_to_table(coalesce(p_query, ''), '[^[:alnum:]]+') w
           where length(w) >= 3 and lower(w) not in ('apa','yang','dan','untuk','saya','boleh','berapa','adakah','bagi','dengan','ini','itu','the','what','how')) x;
  if q is null then return; end if;
  return query
    select d.title, c.content, ts_rank(c.tsv, q) r
      from ai_knowledge_chunks c join ai_knowledge_docs d on d.id = c.doc_id
     where d.active and (d.company_id = p_company or d.company_id is null) and c.tsv @@ q
     order by r desc
     limit least(greatest(p_limit, 1), 10);
end $$;

create or replace function kb_unanswered(p_company uuid)
returns table(id bigint, question text, name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.question, coalesce(p.preferred_name, p.full_name), u.created_at
    from ai_unanswered u left join persons p on p.id = u.person_id
   where u.company_id = p_company and not u.resolved and has_role(p_company, '{hr,admin}')
   order by u.created_at desc limit 30
$$;

create or replace function kb_resolve_unanswered(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update ai_unanswered set resolved = true where id = p_id and has_role(company_id, '{hr,admin}');
end $$;

-- Tindakan ejen bagi pengguna semasa (PembantuAI → "TINDAKAN EJEN UNTUK ANDA")
create or replace function my_ai_actions(p_limit int default 5)
returns table(action text, payload jsonb, created_at timestamptz, channel action_channel)
language sql stable security definer set search_path = public as $$
  select l.action, l.payload, l.created_at, coalesce(c.channel, 'web')
    from ai_action_log l left join ai_conversations c on c.id = l.conversation_id
   where l.on_behalf_of = current_person_id()
   order by l.created_at desc limit least(greatest(p_limit, 1), 20)
$$;

do $$
declare f text;
begin
  foreach f in array array['kb_save_document(uuid, text, text, uuid)', 'kb_documents(uuid)', 'kb_search(uuid, text, int)',
                           'kb_unanswered(uuid)', 'kb_resolve_unanswered(bigint)', 'my_ai_actions(int)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant update (active) on ai_knowledge_docs to authenticated;
  end if;
end $$;
