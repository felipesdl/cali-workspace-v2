-- Guarda compartilhada dos lotes operacionais da Fase 4.
begin;
set local lock_timeout = '5s';

create function cali_session_guard.require_phase4_role(p_company_id uuid, p_role text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
begin
  if not exists(select 1 from cali_workspace.profiles where id=actor and active and role::text=p_role) then
    raise exception using errcode='42501', message='Operação indisponível para este perfil.';
  end if;
  return actor;
end;
$$;

revoke all on function cali_session_guard.require_phase4_role(uuid,text) from public,anon,authenticated,service_role;
commit;
