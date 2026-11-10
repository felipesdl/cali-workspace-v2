-- Leitura direta do piloto usa a mesma sessão, empresa, MFA e aceite das RPCs.
begin;
set local lock_timeout='5s';
create function cali_session_guard.team_month_read_allowed(p_company_id uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $$
begin
 if not exists(select 1 from cali_session_guard.pilot_companies where company_id=p_company_id) then
  return true;
 end if;
 perform cali_session_guard.require_pilot_team_actor(p_company_id);
 return true;
exception when insufficient_privilege then return false;
end;
$$;
revoke all on function cali_session_guard.team_month_read_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function cali_session_guard.team_month_read_allowed(uuid) to authenticated;
do $$
declare relation text;
begin
 foreach relation in array array['team_month_metrics','team_months','team_month_snapshots',
  'team_month_reviews','team_vacancies','team_vacancy_events'] loop
  execute format('create policy v2_pilot_month_read on cali_workspace.%I as restrictive for select to authenticated using(cali_session_guard.team_month_read_allowed(company_id))',relation);
 end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
