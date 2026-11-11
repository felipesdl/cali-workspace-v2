-- FLOW-17. Acompanhamento de respostas em formulário da empresa piloto.
begin;
set local lock_timeout = '5s';

create or replace function cali_workspace.v2_list_pilot_form_triage(p_company_id uuid,p_form_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;
  return (
    select jsonb_build_object(
      'stages',coalesce((
        select jsonb_agg(stage order by position)
        from jsonb_array_elements(f.stages) with ordinality as choices(stage,position)
        where jsonb_typeof(stage)='string' and length(stage#>>'{}') between 1 and 60
      ),'[]'::jsonb),
      'responses',coalesce((
        select jsonb_agg(to_jsonb(page) order by submitted_at desc,id)
        from (
          select r.id,r.respondent_name,r.submitted_at,r.stage,r.owner,
            coalesce((
              select jsonb_agg(jsonb_build_object(
                'questionId',coalesce(q->>'id',q->>'label'),
                'question',q->>'label',
                'answer',case
                  when q->>'kind'='file' and r.answers ? (q->>'id') then '[Anexo disponível no CALI Forms]'
                  when jsonb_typeof(r.answers->(q->>'id'))='array' then coalesce((
                    select string_agg(item#>>'{}',', ' order by position)
                    from jsonb_array_elements(r.answers->(q->>'id')) with ordinality as items(item,position)
                    where jsonb_typeof(item)='string'
                  ),'')
                  when jsonb_typeof(r.answers->(q->>'id')) in ('string','number','boolean')
                    then r.answers->>(q->>'id')
                  else ''
                end
              ) order by position)
              from jsonb_array_elements(f.questions) with ordinality as questions(q,position)
              where q->>'kind'<>'statement'
            ),'[]'::jsonb) as answers
          from cali_workspace.form_responses r where r.form_id=f.id
          order by r.submitted_at desc,r.id limit 25 offset (p_page-1)*25
        ) page
      ),'[]'::jsonb)
    )
    from cali_workspace.forms f where f.id=p_form_id and f.company_id=p_company_id
  );
end;
$$;

create or replace function cali_workspace.v2_save_pilot_form_triage(
  p_company_id uuid,p_form_id uuid,p_response_id uuid,
  p_expected_stage text,p_expected_owner text,p_stage text,p_owner text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  allowed_stages jsonb;
  current_stage text;
  current_owner text;
  next_stage text := nullif(p_stage,'');
  next_owner text := nullif(btrim(p_owner),'');
begin
  select stages into allowed_stages from cali_workspace.forms f
  where f.id=p_form_id and f.company_id=p_company_id for share;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;

  select r.stage,r.owner into current_stage,current_owner from cali_workspace.form_responses r
  where r.id=p_response_id and r.form_id=p_form_id for update;
  if not found then raise exception using errcode='42501',message='Resposta indisponível.'; end if;

  if (current_stage,current_owner) is not distinct from (next_stage,next_owner) then
    return p_response_id;
  end if;
  if (current_stage,current_owner) is distinct from (p_expected_stage,p_expected_owner) then
    raise exception using errcode='40001',message='A triagem mudou. Reabra a resposta.';
  end if;
  if length(next_owner)>120
     or (next_stage is distinct from current_stage and next_stage is not null
         and (length(next_stage)>60 or not (coalesce(allowed_stages,'[]'::jsonb) @> jsonb_build_array(next_stage)))) then
    raise exception using errcode='22023',message='Etapa ou responsável inválido.';
  end if;

  update cali_workspace.form_responses set stage=next_stage,owner=next_owner where id=p_response_id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_response_triaged','form_response',p_response_id,'{}');
  return p_response_id;
end;
$$;

revoke all on function cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer),
  cali_workspace.v2_save_pilot_form_triage(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer),
  cali_workspace.v2_save_pilot_form_triage(uuid,uuid,uuid,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
