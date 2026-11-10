#!/bin/sh
# PostgreSQL descartável; sem rede, Auth, Edge ou Docker.
set -eu
suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-phase4.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir" -l "$qa_dir/db.log" start >/dev/null
psql -X -h "$qa_dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$suite_dir/test-read.sql"
psql -X -h "$qa_dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "DROP OWNED BY authenticated,anon,service_role; DROP ROLE authenticated,anon,service_role;"

createdb -h "$qa_dir" -U postgres phase4_write
psql -X -h "$qa_dir" -U postgres -d phase4_write -v ON_ERROR_STOP=1 -q -f "$suite_dir/test-write.sql"
