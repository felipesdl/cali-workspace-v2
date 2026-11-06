-- FLOW-17. Administração de formulários vinculados explicitamente ao piloto.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_list_pilot_forms(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página inválida.';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id),'[]'::jsonb)
    from (
      select f.id,f.slug,f.title,f.status,f.created_at,
        (select count(*) from cali_workspace.form_responses r where r.form_id=f.id) as responses
      from cali_workspace.forms f where f.company_id=p_company_id
      order by f.created_at desc,f.id limit 25 offset (p_page-1)*25
    ) page
  );
end;
$$;

create function cali_workspace.v2_set_pilot_form_state(p_company_id uuid,p_form_id uuid,p_expected text,p_next text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if not coalesce(
    (p_next='open' and p_expected in ('draft','closed')) or (p_next='closed' and p_expected='open'),false
  ) then raise exception using errcode='22023', message='Transição indisponível.'; end if;
  update cali_workspace.forms f set status=p_next,updated_at=now()
  where f.id=p_form_id and f.company_id=p_company_id and f.status=p_expected
    and (p_next='closed' or jsonb_array_length(f.questions)>0);
  if not found then raise exception using errcode='40001', message='Formulário mudou ou está sem perguntas.'; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_'||p_next,'form',p_form_id,'{}');
  return p_form_id;
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_forms(uuid,integer),
  cali_workspace.v2_set_pilot_form_state(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_forms(uuid,integer),
  cali_workspace.v2_set_pilot_form_state(uuid,uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
