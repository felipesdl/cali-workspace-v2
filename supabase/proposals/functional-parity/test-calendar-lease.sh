#!/bin/sh
# PostgreSQL descartável local; nenhuma rede, projeto Supabase ou credencial.
set -eu
umask 077
proposal_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
pg_bin=$(dirname "$(command -v psql)")
qa_dir=$(mktemp -d /tmp/cali-calendar-lease.XXXXXXXX)
cleanup() {
  "$pg_bin/pg_ctl" -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$qa_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$qa_dir/socket"
"$pg_bin/initdb" -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
"$pg_bin/pg_ctl" -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir/socket -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap" -l "$qa_dir/postgres.log" start >/dev/null
psql_local() {
  "$pg_bin/psql" -X -h "$qa_dir/socket" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}
psql_local -q -f "$proposal_dir/calendar-lease-test-fixture.sql"
psql_local -q -f "$proposal_dir/calendar-lease.sql"
psql_local -q -f "$proposal_dir/calendar-lease-test.sql"

gate="$qa_dir/start"
worker() {
  output=$1
  while [ ! -f "$gate" ]; do sleep 0.01; done
  psql_local -qAt -c "begin; set local role service_role; select cali_workspace.v2_agenda_calendar_lease('10000000-0000-4000-8000-000000000005','acquire',null)->>'acquired'; select pg_sleep(0.35); commit;" > "$output"
}
worker "$qa_dir/worker-a" & worker_a=$!
worker "$qa_dir/worker-b" & worker_b=$!
touch "$gate"
wait "$worker_a"
wait "$worker_b"
true_count=$(cat "$qa_dir/worker-a" "$qa_dir/worker-b" | grep -c '^true$' || true)
false_count=$(cat "$qa_dir/worker-a" "$qa_dir/worker-b" | grep -c '^false$' || true)
if [ "$true_count" -ne 1 ] || [ "$false_count" -ne 1 ]; then
  cat "$qa_dir/worker-a" "$qa_dir/worker-b"
  printf '%s\n' 'Falha: acquire concorrente não teve um vencedor e um busy.' >&2
  exit 1
fi

psql_local -qAt <<'SQL'
update cali_session_guard.agenda_calendar_leases
  set lease_until=clock_timestamp()-interval '1 second';
set role service_role;
select (cali_workspace.v2_agenda_calendar_lease(
  '10000000-0000-4000-8000-000000000005','acquire',null)->>'acquired')='true';
reset role;
SQL
printf '%s\n' 'PASS lease concorrente, expiração/crash, retry, token fencing, release e grants.'
