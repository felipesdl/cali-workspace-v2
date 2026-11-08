-- RESUMO-01. Primeira confirmação Cliente gera aviso Admin sem e-mail.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_notify_first_client_month_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from cali_session_guard.pilot_companies p where p.company_id=new.company_id)
    and exists(select 1 from cali_workspace.profiles p where p.id=new.actor_id
      and p.company_id=new.company_id and p.role::text='client' and p.active) then
    perform cali_workspace.notify_workspace_movement(new.company_id,new.actor_id,'admin',
      'team_month_confirmed','Dados do mês confirmados',
      'Equipe · referência '||to_char(new.reference_month,'MM/YYYY'),
      'team_month_review',new.id,
      '/admin/equipe?companyId='||new.company_id::text||'&view=monthly&month='||to_char(new.reference_month,'YYYY-MM'),
      'normal',false);
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_notify_first_client_month_review()
  from public,anon,authenticated,service_role;

drop trigger if exists phase4_notify_first_client_month_review on cali_session_guard.team_month_events;
create trigger phase4_notify_first_client_month_review
after insert on cali_session_guard.team_month_events
for each row when (new.domain='review' and new.revision=1 and new.before_state is null)
execute function cali_session_guard.phase4_notify_first_client_month_review();
commit;
