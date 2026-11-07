#!/bin/sh
# DEC-28. Ensaia a restauração de fixtures, sem conectar a serviço hospedado.
set -eu
umask 077
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGSERVICE PGSERVICEFILE PGPASSFILE PGPASSWORD PGOPTIONS PGSSLMODE
repo_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
recovery_dir=$(mktemp -d /tmp/cali-recovery.XXXXXXXX)
source_dir="$recovery_dir/source"
restored_dir="$recovery_dir/restored"

cleanup() {
  for instance in "$source_dir" "$restored_dir"; do
    if [ -d "$instance/db" ]; then
      pg_ctl -D "$instance/db" -m fast stop >/dev/null 2>&1 || true
    fi
  done
  rm -rf -- "$recovery_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_instance() {
  instance=$1
  mkdir -p "$instance/socket"
  initdb -D "$instance/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
  pg_ctl -D "$instance/db" -o "-c listen_addresses= -k $instance/socket" -l "$instance/postgres.log" start >/dev/null
}

start_instance "$source_dir"
start_instance "$restored_dir"
psql -X -h "$source_dir/socket" -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  -f "$repo_dir/tests/fixtures/phase4/read-context.sql" \
  -f "$repo_dir/supabase/proposals/phase-4/read-hours.sql"
psql -X -h "$restored_dir/socket" -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  -c 'create role anon; create role authenticated; create role service_role;'
pg_dump -h "$source_dir/socket" -U postgres -d postgres -Fc -f "$recovery_dir/database.dump"

mkdir "$source_dir/objects" "$restored_dir/objects"
printf '%%PDF-1.4\nCALI fixture de recuperação\n' > "$source_dir/objects/exemplo.pdf"
tar -C "$source_dir/objects" -cf "$recovery_dir/objects.tar" exemplo.pdf
(cd "$recovery_dir" && shasum -a 256 database.dump objects.tar > SHA256SUMS && shasum -a 256 -c SHA256SUMS)
pg_restore -h "$restored_dir/socket" -U postgres -d postgres --exit-on-error "$recovery_dir/database.dump"
tar -C "$restored_dir/objects" -xf "$recovery_dir/objects.tar"
cmp "$source_dir/objects/exemplo.pdf" "$restored_dir/objects/exemplo.pdf"

probe() {
  psql -X -h "$1/socket" -U postgres -d postgres -v ON_ERROR_STOP=1 -At <<'SQL'
select count(*) from cali_workspace.projects;
select count(*) from cali_workspace.hour_entries;
select has_function_privilege('authenticated','cali_workspace.v2_read_pilot_hours(uuid,date,integer)','EXECUTE'),
  has_function_privilege('anon','cali_workspace.v2_read_pilot_hours(uuid,date,integer)','EXECUTE');
select md5(pg_get_functiondef('cali_workspace.v2_read_pilot_hours(uuid,date,integer)'::regprocedure));
SQL
}
probe "$source_dir" > "$recovery_dir/source.evidence"
probe "$restored_dir" > "$recovery_dir/restored.evidence"
cmp "$recovery_dir/source.evidence" "$recovery_dir/restored.evidence"
printf '%s\n' 'Restauração sintética conferida em segundo cluster: contagens, função, grants e bytes do arquivo.'
