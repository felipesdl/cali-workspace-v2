#!/bin/sh
# Usa exclusivamente PostgreSQL descartável em socket Unix, com dependências simuladas.
set -eu
suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-preview.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
for suite in preview-access-test drive-test forms-origin-dispatch-test forms-confirmation-test satisfaction-requests-test; do
  initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
  pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir" -l "$qa_dir/db.log" start >/dev/null
  psql -X -h "$qa_dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$suite_dir/$suite.sql"
  pg_ctl -D "$qa_dir/db" -m fast stop >/dev/null
  rm -rf -- "$qa_dir/db"
  printf 'PASS %s\n' "$suite"
done
