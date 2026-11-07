-- Pembetulan v0.2: di Supabase, pgcrypto dipasang dalam skema `extensions`,
-- bukan `public`. Fungsi yang memanggil gen_random_bytes() / digest() dengan
-- `set search_path = public` gagal ("function gen_random_bytes(integer) does not exist").
-- Tambah `extensions` pada search_path fungsi tersebut. Pada Postgres biasa
-- (ujian tempatan) skema `extensions` tidak wujud dan diabaikan tanpa ralat.
alter function public.create_invite(uuid) set search_path = public, extensions;
alter function public.accept_invite(text, text) set search_path = public, extensions;
