#!/usr/bin/env bash
# Somente PostgreSQL descartável; socket local e sem listener de rede.
set -euo pipefail
cd "$(dirname "$0")"
qa_dir=$(mktemp -d /tmp/cali-invite-capacity.XXXXXXXX)
cleanup() {
  pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$qa_dir"
}
trap cleanup EXIT
export PGHOST="$qa_dir" PGPORT=55451 PGUSER=postgres
export PGDATABASE=cali_session_cut_20261101_00ab0001
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir -p $PGPORT" -l "$qa_dir/db.log" start >/dev/null
createdb
psql -Xq -v ON_ERROR_STOP=1 -f test-individual-invites.sql

insert_invite() {
  printf "insert into cali_workspace.client_invites (company_id,email,full_name) values ('9c5ab148-78b8-4410-9338-58c44222a5db','%s@example.test','Concorrência');\n" "$1"
}

# FIFO segura a primeira transação aberta após a quarta vaga. A segunda
# conexão deve esperar no lock, e só depois observar que não há quinta.
mkfifo "$qa_dir/release"
{
  printf 'begin;\n'
  insert_invite race-first
  printf '\\! touch "%s/first-ready"; read -r line < "%s/release"\ncommit;\n' "$qa_dir" "$qa_dir"
} > "$qa_dir/first.sql"
PGAPPNAME=cali_capacity_first psql -Xq -v ON_ERROR_STOP=1 -f "$qa_dir/first.sql" > "$qa_dir/first.log" 2>&1 &
first_pid=$!
for ((i=0; i<50; i++)); do
  [[ -e "$qa_dir/first-ready" ]] && break
  sleep 0.1
done
[[ -e "$qa_dir/first-ready" ]] || { cat "$qa_dir/first.log"; exit 1; }

insert_invite race-second > "$qa_dir/second.sql"
PGAPPNAME=cali_capacity_second psql -Xq -v ON_ERROR_STOP=1 -f "$qa_dir/second.sql" > "$qa_dir/second.log" 2>&1 &
second_pid=$!
waiting=
for ((i=0; i<50; i++)); do
  waiting=$(psql -XAtqc "select 1 from pg_stat_activity where application_name='cali_capacity_second' and wait_event_type='Lock'")
  [[ "$waiting" == 1 ]] && break
  sleep 0.1
done
printf 'commit\n' > "$qa_dir/release"
wait "$first_pid" || { cat "$qa_dir/first.log"; exit 1; }
if wait "$second_pid"; then
  echo 'Falha: quinta vaga gravada' >&2
  exit 1
fi
[[ "$waiting" == 1 ]] && rg -q 'Cada empresa pode ter até 4 acessos' "$qa_dir/second.log"
[[ $(psql -XAtqc "select count(*) from cali_workspace.client_invites where company_id='9c5ab148-78b8-4410-9338-58c44222a5db' and active") == 4 ]]
echo 'Disputa confirmada: segunda conexão aguardou o lock e foi recusada; quatro vagas ativas.'
