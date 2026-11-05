-- Preserva dados e demais policies; restaura a leitura anterior ao complemento.
begin;
set local lock_timeout='5s';
do $$
declare relation text;
begin
 foreach relation in array array['team_month_metrics','team_months','team_month_snapshots',
  'team_month_reviews','team_vacancies','team_vacancy_events'] loop
  execute format('drop policy v2_pilot_month_read on cali_workspace.%I',relation);
 end loop;
end;
$$;
drop function cali_session_guard.team_month_read_allowed(uuid);
notify pgrst,'reload schema';
commit;
