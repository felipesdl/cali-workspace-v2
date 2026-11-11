#!/bin/sh
# PostgreSQL disposable over Unix socket; no hosted connection or application.
set -eu
suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-disc3-legacy.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap -k $qa_dir" -l "$qa_dir/db.log" start >/dev/null
cd "$(dirname -- "$suite_dir")/../.."
psql -X -h "$qa_dir" -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$suite_dir/test-legacy-bridge.sql"
