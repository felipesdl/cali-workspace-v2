-- FLOW-17. Um PDF de até 2 MiB por resposta. Download vinculado à coleta e ao Admin da empresa.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_form_pdfs (
  response_id uuid primary key references cali_workspace.form_responses(id) on delete cascade
    deferrable initially deferred,
  question_id uuid not null,
  bytes bytea not null check(octet_length(bytes) between 8 and 2097152)
);
alter table cali_session_guard.phase4_form_pdfs enable row level security;
revoke all on cali_session_guard.phase4_form_pdfs from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_read_pilot_form_pdf(
  p_company_id uuid,p_form_id uuid,p_response_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  pdf bytea;
begin
  select a.bytes into pdf from cali_session_guard.phase4_form_pdfs a
  join cali_workspace.form_responses r on r.id=a.response_id
  join cali_workspace.forms f on f.id=r.form_id
  where a.response_id=p_response_id and f.id=p_form_id and f.company_id=p_company_id;
  if not found then raise exception using errcode='42501',message='Anexo indisponível.'; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_pdf_downloaded','form',p_form_id,
    jsonb_build_object('responseId',p_response_id,'bytes',octet_length(pdf)));
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return jsonb_build_object('id',p_response_id,'fileName','anexo-resposta-cali.pdf',
    'content',encode(pdf,'base64'),'sha256',encode(sha256(pdf),'hex'));
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_form_pdf(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_form_pdf(uuid,uuid,uuid) to authenticated;

-- Anexos legados permanecem no bucket privado cali-forms. Retorna apenas caminhos
-- derivados das respostas e perguntas deste formulário, após revalidar Admin/MFA.
create or replace function cali_workspace.v2_list_pilot_form_attachments(
  p_company_id uuid,p_form_id uuid,p_response_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  form_questions jsonb;
  response_answers jsonb;
  result jsonb;
begin
  perform cali_session_guard.require_phase4_role(p_company_id,'admin');
  select f.questions,r.answers into form_questions,response_answers
  from cali_workspace.forms f
  join cali_workspace.form_responses r on r.form_id=f.id
  where f.id=p_form_id and f.company_id=p_company_id and r.id=p_response_id;
  if not found then raise exception using errcode='42501',message='Anexo indisponível.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',candidate.question_id||':'||candidate.file_position::text,
    'fileName',case
      when position('/' in candidate.path)=0 then candidate.path
      else split_part(candidate.path,'/',array_length(string_to_array(candidate.path,'/'),1)) end,
    'path',candidate.path
  ) order by candidate.question_position,candidate.file_position),'[]'::jsonb)
  into result
  from (
    select q.item->>'id' as question_id,q.position as question_position,p.position as file_position,p.path
    from jsonb_array_elements(form_questions) with ordinality as q(item,position)
    cross join lateral (
      select answer.value#>>'{}' as path,1::bigint as position
      from jsonb_each(response_answers) answer
      where answer.key=q.item->>'id' and jsonb_typeof(answer.value)='string'
      union all
      select file.value#>>'{}' as path,file.position
      from jsonb_each(response_answers) answer
      cross join lateral jsonb_array_elements(case when jsonb_typeof(answer.value)='array'
        then answer.value else '[]'::jsonb end) with ordinality as file(value,position)
      where answer.key=q.item->>'id' and jsonb_typeof(answer.value)='array'
        and jsonb_typeof(file.value)='string'
    ) p
    where q.item->>'kind'='file'
      and (p.path ~ '^https://(drive[.]google[.]com|docs[.]google[.]com)/'
        or (p.path like p_form_id::text||'/%' and exists(
          select 1 from storage.objects o where o.bucket_id='cali-forms' and o.name=p.path)))
  ) candidate;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  return result;
end;
$$;
revoke all on function cali_workspace.v2_list_pilot_form_attachments(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_list_pilot_form_attachments(uuid,uuid,uuid) to authenticated;
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer)'::regprocedure);
  previous constant text := 'select r.id,r.respondent_name,r.submitted_at,r.stage,r.owner';
  added constant text := ', exists(select 1 from cali_session_guard.phase4_form_pdfs p where p.response_id=r.id) as "pdfAvailable", exists(select 1 from jsonb_array_elements(f.questions) q where q->>''kind''=''file'' and r.answers ? (q->>''id'')) as "attachmentsAvailable"';
begin
  if strpos(definition,previous||added)>0 then return; end if;
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
    raise exception 'Projeção de triagem de Forms mudou.';
  end if;
  execute replace(definition,previous,previous||added);
end;
$$;
notify pgrst,'reload schema';
commit;
