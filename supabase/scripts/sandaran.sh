#!/usr/bin/env bash
# Sandaran pangkalan data HRBoost (skema + data) yang disulitkan.
#
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<kata-laluan>@<hos>:5432/postgres \
#   SANDARAN_KATA_LALUAN=<frasa panjang> \
#   bash supabase/scripts/sandaran.sh [folder-output]
#
# Hasil: <folder>/hrboost-<tarikh>.sql.gz.gpg (AES-256, gpg simetri). Tiada rahsia disimpan dalam repo:
# kedua-dua nilai di atas datang daripada pemboleh ubah persekitaran (GitHub Secrets dalam aliran kerja).
# Pulihkan:  gpg -d hrboost-<tarikh>.sql.gz.gpg | gunzip | psql "$SASARAN_DB_URL"
set -euo pipefail
: "${SUPABASE_DB_URL:?Tetapkan SUPABASE_DB_URL}"
: "${SANDARAN_KATA_LALUAN:?Tetapkan SANDARAN_KATA_LALUAN}"
OUT="${1:-sandaran}"
mkdir -p "$OUT"
NAMA="$OUT/hrboost-$(date -u +%Y%m%d-%H%M).sql.gz.gpg"
# Skema public + storage metadata + auth (pengguna) — tanpa pemilik/hak supaya boleh dipulihkan ke projek lain
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --quote-all-identifiers \
  --schema=public --schema=auth --schema=storage --schema=supabase_migrations \
  | gzip -9 \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-fd 3 -o "$NAMA" 3<<<"$SANDARAN_KATA_LALUAN"
echo "Sandaran: $NAMA ($(du -h "$NAMA" | cut -f1))"
