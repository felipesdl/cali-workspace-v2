#!/bin/sh
# PostgreSQL descartável. Sem rede, Auth real ou comunicação.
set -eu
suite=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
qa=$(mktemp -d /tmp/cali-phase5-review.XXXXXXXX)
trap 'pg_ctl -D "$qa/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$qa"' EXIT
initdb -D "$qa/db" -U postgres --no-locale --encoding=UTF8 -A trust >/dev/null
pg_ctl -D "$qa/db" -o "-c listen_addresses= -k $qa" -l "$qa/db.log" start >/dev/null
psql -X -h "$qa" -U postgres -v ON_ERROR_STOP=1 -q \
  -f "$suite/../../../tests/fixtures/phase5/partner-review.sql" \
  -f "$suite/../phase-4/staff-pilot-admission.sql" \
  -f "$suite/partner-pilot.sql" \
  -f "$suite/../phase-4/operation-receipts.sql" \
  -f "$suite/partner-hour-review.sql" \
  -f "$suite/partner-timer.sql" \
  -f "$suite/partner-review.sql" \
  -c "set cali.qa.review_admin = 'on'" \
  -f "$suite/prove-partner-review.sql" \
  -f "$suite/prove-partner-timer.sql"
