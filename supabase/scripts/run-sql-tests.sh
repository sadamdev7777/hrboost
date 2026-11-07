#!/usr/bin/env bash
# Jalankan ujian SQL HRBoost pada Postgres 16 TEMPATAN sahaja.
#
# Setiap fail ujian dijalankan pada pangkalan data baharu:
#   1. stub Supabase (supabase/tests/local_only)  -- HANYA untuk ujian tempatan
#   2. migrasi (supabase/migrations/*.sql)
#   3. fail ujian
#
# Jangan sekali-kali jalankan skrip ini atau fail stub pada projek Supabase sebenar.
# Skrip menolak sebarang sambungan yang bukan ke localhost / 127.0.0.1.
#
# Pemboleh ubah:
#   PGHOST (lalai 127.0.0.1), PGPORT (lalai 55432), PGUSER (lalai postgres), PGPASSWORD (lalai postgres)
#   SKIP_DOCKER=1  guna pelayan Postgres 16 sedia ada dan tidak memulakan bekas Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
CONTAINER="hrboost-sqltest-pg16"

case "$PGHOST" in
  127.0.0.1|localhost|::1) ;;
  *) echo "DITOLAK: PGHOST=$PGHOST bukan pelayan tempatan. Stub hanya untuk ujian tempatan." >&2; exit 2 ;;
esac

if [[ "${SKIP_DOCKER:-0}" != "1" ]]; then
  if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASSWORD" \
      -p "127.0.0.1:${PGPORT}:5432" pgvector/pgvector:pg16 >/dev/null
  fi
  for _ in $(seq 1 60); do
    pg_isready -q && break
    sleep 1
  done
fi

server_major="$(psql -d postgres -Atc 'show server_version_num' | cut -c1-2)"
if [[ "$server_major" != "16" ]]; then
  echo "Amaran: pelayan ialah Postgres $server_major, bukan 16." >&2
fi

STUB="$ROOT/supabase/tests/local_only/hrboost_tests_stub_local_only.sql"
shopt -s nullglob
MIGRATIONS=("$ROOT"/supabase/migrations/*.sql)
TESTS=("$ROOT"/supabase/tests/*.sql)

run_one() {
  local db="$1" test_file="$2" m
  psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$STUB" || return 1
  for m in "${MIGRATIONS[@]}"; do
    psql -d "$db" -q -v ON_ERROR_STOP=1 -f "$m" >/dev/null || return 1
  done
  psql -d "$db" -v ON_ERROR_STOP=1 -f "$test_file"
}

fail=0
for t in "${TESTS[@]}"; do
  name="$(basename "$t" .sql)"
  db="hrboost_test_$(echo "$name" | tr -c 'a-zA-Z0-9\n' '_')"
  echo "================================================================"
  echo "UJIAN: $name  (pangkalan data: $db)"
  echo "================================================================"
  psql -d postgres -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$db\"" -c "create database \"$db\""
  if run_one "$db" "$t"; then
    echo ">>> LULUS: $name"
  else
    echo ">>> GAGAL: $name"
    fail=1
  fi
done

exit $fail
