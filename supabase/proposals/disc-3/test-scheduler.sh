#!/bin/sh
# Só PostgreSQL descartável, socket Unix e transportes sintéticos. Nenhum envio.
set -eu
suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-disc-scheduler.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir" -l "$qa_dir/db.log" start >/dev/null
psql -X -h "$qa_dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$suite_dir/test-scheduler.sql"
python3 - "$qa_dir" <<'PY'
import subprocess
import sys

connection = ['psql', '-X', '-h', sys.argv[1], '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt']
first = subprocess.Popen(connection, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    first.stdin.write("begin; select cali_v2_disc.worker_at('claim',null,'{}','2026-11-06 22:00Z')->>'id';\n")
    first.stdin.flush()
    job = first.stdout.readline().strip()
    if not job:
        raise RuntimeError('Primeira conexão não reservou tarefa')
    second = subprocess.run(connection, input="select cali_v2_disc.worker_at('claim',null,'{}','2026-11-06 22:00Z') is null;", capture_output=True, text=True, check=True, timeout=10)
    if second.stdout.strip() != 't':
        raise RuntimeError('Duas conexões reservaram a mesma tarefa')
    first.stdin.write('commit;\n\\q\n')
    first.stdin.flush()
    first.wait(timeout=10)
    if first.returncode != 0:
        raise RuntimeError('Falha no commit da reserva')
    print('PASS: duas conexões, uma reserva; SKIP LOCKED sem espera')
finally:
    if first.poll() is None:
        first.kill()
        first.wait()
PY
psql -X -h "$qa_dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
create table public.scheduler_history_counts as select (select count(*) from cali_v2_disc.jobs) jobs,(select count(*) from cali_v2_disc.campaigns) campaigns,(select count(*) from cali_v2_disc.invites) invites,(select count(*) from cali_v2_disc.events) events,(select count(*) from cali_v2_disc.revisions) revisions;
\i $suite_dir/rollback-scheduler.sql
select public.check_scheduler(not exists(select 1 from public.scheduler_preimage p where p.definition<>pg_get_functiondef(p.identity::regprocedure)), 'rollback restaura funções exatas');
select public.check_scheduler((select jobs=(select count(*) from cali_v2_disc.jobs) and campaigns=(select count(*) from cali_v2_disc.campaigns) and invites=(select count(*) from cali_v2_disc.invites) and events=(select count(*) from cali_v2_disc.events) and revisions=(select count(*) from cali_v2_disc.revisions) from public.scheduler_history_counts) and (select not enabled from cali_v2_disc.config), 'rollback preserva histórico e agenda desligada');
SQL
