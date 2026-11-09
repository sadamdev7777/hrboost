-- Alamat syarikat (kepala surat) boleh dikemas kini oleh Pentadbir melalui Tetapan → Syarikat.
-- Jadual companies menggunakan kebenaran UPDATE mengikut lajur; lajur baharu perlu diberi secara jelas.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant update (address) on companies to authenticated;
  end if;
end $$;
