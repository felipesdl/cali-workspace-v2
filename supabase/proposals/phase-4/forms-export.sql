-- FLOW-17. Planilha de uma coleta V2 de texto encerrada, por Admin com MFA.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_export_pilot_form_responses(p_company_id uuid,p_form_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  form cali_workspace.forms;
  result jsonb;
  response_count integer;
  response_bytes bigint;
begin
  select f.* into form from cali_workspace.forms f
  where f.id=p_form_id and f.company_id=p_company_id and f.status='closed'
    and f.id=(cali_session_guard.phase4_public_text_form(f.slug)).id
  for share of f;
  if not found then
    raise exception using errcode='42501',message='Formulário indisponível para exportação.';
  end if;
  select count(*),coalesce(sum(octet_length(row::text)),0) into response_count,response_bytes
  from (select r.answers,r.stage,r.owner from cali_workspace.form_responses r where r.form_id=form.id limit 501) row;
  if response_count>500 or response_bytes>2097152 then
    raise exception using errcode='P4F01',message='A coleta excede o limite da exportação.';
  end if;

  select jsonb_build_object(
    'slug',form.slug,
    'questions',form.questions,
    'responses',coalesce(jsonb_agg(jsonb_build_object(
      'submittedAt',r.submitted_at,'stage',r.stage,'owner',r.owner,'values',
      (select jsonb_agg(case when jsonb_typeof(r.answers->(q->>'id'))='string'
        then r.answers->>(q->>'id') else '' end order by pos)
       from jsonb_array_elements(form.questions) with ordinality as questions(q,pos))
    ) order by r.submitted_at,r.id),'[]'::jsonb)
  ) into result
  from cali_workspace.form_responses r where r.form_id=form.id;
  if jsonb_array_length(result->'responses')>500 or octet_length(result::text)>2097152 then
    raise exception using errcode='P4F01',message='A coleta excede o limite da exportação.';
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_responses_exported','form',form.id,
    jsonb_build_object('count',jsonb_array_length(result->'responses')));
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return result;
end;
$$;
revoke all on function cali_workspace.v2_export_pilot_form_responses(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_export_pilot_form_responses(uuid,uuid) to authenticated;
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_list_pilot_forms(uuid,integer)'::regprocedure);
  previous constant text := 'as "publicTextLink",';
  next constant text := previous||
    ' (f.status=''closed'' and (cali_session_guard.phase4_public_text_form(f.slug)).id is not null) as "textExportAvailable",';
begin
  if strpos(definition,next)>0 then return; end if;
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
    raise exception 'Projeção de formulários mudou.';
  end if;
  execute replace(definition,previous,next);
end;
$$;
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_read_pilot_audit(uuid,date,integer)'::regprocedure);
  previous constant text := quote_literal('form_response_triaged');
  next constant text := previous||','||quote_literal('form_responses_exported');
begin
  if strpos(definition,next)>0 then return; end if;
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
    raise exception 'Projeção de auditoria mudou.';
  end if;
  execute replace(definition,previous,next);
end;
$$;
notify pgrst,'reload schema';
commit;
