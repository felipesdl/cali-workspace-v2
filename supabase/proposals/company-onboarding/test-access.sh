#!/bin/sh
# Suite isolada. O PostgreSQL só escuta no socket do diretório descartável.
set -eu

suite_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa_dir=$(mktemp -d /tmp/cali-access.XXXXXXXX)
trap 'pg_ctl -D "$qa_dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa_dir"' EXIT
initdb -D "$qa_dir/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa_dir/db" -o "-c listen_addresses= -k $qa_dir -p 55448" -l "$qa_dir/db.log" start >/dev/null

db() {
  psql -X -h "$qa_dir" -p 55448 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

db -q -f "$suite_dir/access-fixture.sql"
company=$(db -qAt -c 'select company_id from cali_v2_onboarding.company_drafts where access_management_enabled')
cat > "$qa_dir/reserve.sql" <<'SQL'
begin;
set local role authenticated;
set local test.actor = '00000000-0000-4000-8000-000000000001';
set local test.session = '00000000-0000-4000-8000-000000000051';
set local test.aal = 'aal2';
select cali_workspace.v2_manage_company_access(
  :'company', gen_random_uuid(), 'invite', null, :'email', 'Pessoa QA'
);
select pg_sleep(0.2);
commit;
SQL

for n in 1 2 3 4 5; do
  (
    if db -qAt -v company="$company" -v email="qa-access-$n@example.test" \
      -f "$qa_dir/reserve.sql" > "$qa_dir/out-$n" 2> "$qa_dir/error-$n"; then
      printf 'accepted\n' > "$qa_dir/result-$n"
    elif rg -q 'As quatro vagas estão ocupadas' "$qa_dir/error-$n"; then
      printf 'full\n' > "$qa_dir/result-$n"
    else
      cat "$qa_dir/error-$n" >&2
      printf 'unexpected\n' > "$qa_dir/result-$n"
    fi
  ) &
done
wait
test "$(cat "$qa_dir"/result-* | sort | uniq -c | awk '{ print $1, $2 }')" = "$(printf '4 accepted\n1 full')"
printf '%s\n' 'Concorrência: quatro convites aceitos e a quinta solicitação recusada.'
db -q -f "$suite_dir/access-revocation-acceptance.sql"
printf '%s\n' 'Revogação: vaga liberada, sessão e código antigos recusados, outro cliente preservado.'
printf '%s\n' 'Storage: sessão admitida lê objetos próprios, e o corte bloqueia a sessão antiga após reativação.'
printf '%s\n' 'Perfil: guarda recusa sessão cortada em escritor legado SECURITY DEFINER e preserva edição admitida.'
