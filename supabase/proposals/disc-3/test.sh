#!/bin/sh
# PostgreSQL descartável em socket Unix. Não inicia Auth, Edge, Docker ou serviços remotos.
set -eu
suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-disc3.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir" -l "$qa_dir/db.log" start >/dev/null
psql -X -h "$qa_dir" -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$suite_dir/test.sql"
