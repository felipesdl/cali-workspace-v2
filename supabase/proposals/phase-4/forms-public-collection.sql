-- FLOW-17. Coleta pública V2 para formulários compatíveis e abertos explicitamente no piloto.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_public_form_receipts (
  form_id uuid not null references cali_workspace.forms(id) on delete cascade,
  request_id uuid not null,
  fingerprint bytea not null,
  primary key(form_id,request_id)
);
alter table cali_session_guard.phase4_public_form_receipts enable row level security;
revoke all on cali_session_guard.phase4_public_form_receipts from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_form_public_questions_valid(p_questions jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case when jsonb_typeof(p_questions) is distinct from 'array' then false
  else jsonb_array_length(p_questions) between 1 and 40
    and not exists(select 1 from jsonb_array_elements(p_questions) q
      where case when jsonb_typeof(q) is distinct from 'object' then true else
        coalesce(q->>'kind','') not in ('name','email','phone','short_text','long_text','number','date','single_choice','multi_choice','yes_no','file')
        or coalesce(q->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(length(q->>'label'),0) not between 1 and 400
        or jsonb_typeof(q->'required') is distinct from 'boolean'
        or not cali_session_guard.phase4_form_options_valid(q->>'kind',q->'options')
        or q-'id'-'kind'-'label'-'required'-'options'-'logic'<>'{}'::jsonb end)
    and (select count(*) from jsonb_array_elements(p_questions) q where q->>'kind'='file')<=1
    and cali_session_guard.phase4_form_logic_valid(p_questions)
    and (select count(distinct q->>'id')=count(*) from jsonb_array_elements(p_questions) q)
  end;
$$;
revoke all on function cali_session_guard.phase4_form_public_questions_valid(jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_form_public_eligible(
  p_company uuid,p_id uuid,p_slug text,p_audience text,p_confirm_email boolean,p_questions jsonb
)
returns boolean language sql stable set search_path='' as $$
  select p_audience='client' and not p_confirm_email and length(p_slug) between 1 and 100
    and cali_session_guard.phase4_form_public_questions_valid(p_questions)
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=p_company and l.entity_id=p_id and l.entity_type='form'
        and l.event_type='form_draft_created');
$$;
revoke all on function cali_session_guard.phase4_form_public_eligible(uuid,uuid,text,text,boolean,jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_open_pilot_public_form(
  p_company_id uuid,p_form_id uuid,p_expected text,p_confirm_public boolean
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  form cali_workspace.forms;
begin
  if p_confirm_public is distinct from true or not coalesce(p_expected in ('draft','closed'),false) then
    raise exception using errcode='22023',message='Confirme que o formulário ficará público por link.';
  end if;
  select f.* into form from cali_workspace.forms f
  where f.id=p_form_id and f.company_id=p_company_id and f.status=p_expected for update;
  if not found then
    raise exception using errcode='40001',message='O formulário mudou.';
  end if;
  if cali_session_guard.phase4_form_public_eligible(
    form.company_id,form.id,form.slug,form.audience::text,form.confirm_email,form.questions
  ) is distinct from true then
    raise exception using errcode='P4F02',message='Este formulário não é compatível com a coleta da V2.';
  end if;
  update cali_workspace.forms set status='open',updated_at=now() where id=form.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_open','form',p_form_id,jsonb_build_object('collection','public_link'));
  return p_form_id;
end;
$$;
revoke all on function cali_workspace.v2_open_pilot_public_form(uuid,uuid,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_open_pilot_public_form(uuid,uuid,text,boolean) to authenticated;

create or replace function cali_session_guard.phase4_public_text_form(p_slug text)
returns cali_workspace.forms language sql stable set search_path=''
as $$
  select f from cali_workspace.forms f
  join cali_session_guard.pilot_companies p on p.company_id=f.company_id
  where f.slug=p_slug and length(p_slug) between 1 and 100
    and f.status in ('open','closed')
    and cali_session_guard.phase4_form_public_eligible(
      f.company_id,f.id,f.slug,f.audience::text,f.confirm_email,f.questions)
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=f.company_id and l.entity_id=f.id and l.entity_type='form'
        and l.event_type='form_open' and l.metadata->>'collection'='public_link');
$$;
revoke all on function cali_session_guard.phase4_public_text_form(text) from public,anon,authenticated,service_role;

create or replace function public.v2_read_pilot_public_text_form(p_slug text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  form cali_workspace.forms := cali_session_guard.phase4_public_text_form(p_slug);
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if form.id is null then return null; end if;
  if form.status='closed' then return jsonb_build_object('status','closed'); end if;
  return jsonb_build_object('status','open','title',form.title,'description',form.description,'questions',form.questions);
end;
$$;

create or replace function cali_session_guard.phase4_form_reachable(p_questions jsonb,p_answers jsonb)
returns table(question jsonb) language sql immutable set search_path='' as $$
  with recursive ordered as (
    select q.item,q.position from jsonb_array_elements(p_questions) with ordinality q(item,position)
  ), path as (
    select item,position from ordered where position=1
    union all
    select target.item,target.position from path current
    left join lateral (
      select rule->>'goTo' as destination from jsonb_array_elements(current.item->'logic') rule
      where to_jsonb(rule->>'when')=p_answers->(current.item->>'id') limit 1
    ) rule on true
    join ordered target on target.position>current.position and case
      when rule.destination is null then target.position=current.position+1
      else target.item->>'id'=rule.destination
    end
  )
  select item from path order by position;
$$;
revoke all on function cali_session_guard.phase4_form_reachable(jsonb,jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_form_answers_valid(p_reached jsonb,p_answers jsonb)
returns boolean language sql immutable set search_path='' as $$
  select not exists(select 1 from jsonb_each(p_answers) as a(key,value)
    where not exists(select 1 from jsonb_array_elements(p_reached) q where q->>'id'=a.key)) and not exists(
    select 1 from jsonb_array_elements(p_reached) q
    cross join lateral (select p_answers->(q->>'id') as value) a
    where case
      when a.value is null or a.value='""'::jsonb
        then q->'required'='true'::jsonb
      when q->>'kind'='file' then a.value<>'"[PDF anexado]"'::jsonb
      when q->>'kind'='number' then jsonb_typeof(a.value)<>'number'
      when q->>'kind'='name' then jsonb_typeof(a.value)<>'string'
        or length(btrim(a.value#>>'{}')) not between 1 and 160
      when q->>'kind'='email' then jsonb_typeof(a.value)<>'string'
        or length(btrim(a.value#>>'{}'))>254
        or btrim(a.value#>>'{}') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      when q->>'kind'='phone' then jsonb_typeof(a.value)<>'string'
        or btrim(a.value#>>'{}') !~ '^[+0-9 .()-]{8,40}$'
        or length(regexp_replace(a.value#>>'{}','[^0-9]','','g'))<8
      when q->>'kind'='yes_no' then a.value not in ('"Sim"'::jsonb,'"Não"'::jsonb)
      when q->>'kind'='single_choice' then not (q->'options' @> jsonb_build_array(a.value))
      when q->>'kind'='multi_choice' then case
        when jsonb_typeof(a.value)<>'array' then true
        else not (q->'options' @> a.value)
          or (jsonb_array_length(a.value)=0 and q->'required'='true'::jsonb)
          or jsonb_array_length(a.value)<>(select count(distinct choice) from jsonb_array_elements(a.value) choice)
      end
      when q->>'kind'='date' then jsonb_typeof(a.value)<>'string'
        or (a.value#>>'{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or not pg_input_is_valid(a.value#>>'{}','date')
      else jsonb_typeof(a.value)<>'string' or length(a.value#>>'{}')>5000
        or (q->'required'='true'::jsonb and btrim(a.value#>>'{}')='')
    end
  );
$$;
revoke all on function cali_session_guard.phase4_form_answers_valid(jsonb,jsonb)
  from public,anon,authenticated,service_role;

-- Protege também a gravação pelo endpoint legado sem mudar a interface dele.
create or replace function cali_session_guard.phase4_check_conditional_response()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  form cali_workspace.forms;
  reached jsonb;
begin
  select f.* into form from cali_workspace.forms f where f.id=new.form_id
    and (jsonb_path_exists(f.questions,'$[*].logic')
      or jsonb_path_exists(f.questions,'$[*] ? (@.kind == "file" || @.kind == "name" || @.kind == "email" || @.kind == "phone")'))
    and f.id=(cali_session_guard.phase4_public_text_form(f.slug)).id
    for share;
  if not found then return new; end if;
  if form.status<>'open' or jsonb_typeof(new.answers) is distinct from 'object' then
    raise exception using errcode='42501',message='Coleta indisponível.';
  end if;
  select coalesce(jsonb_agg(question),'[]'::jsonb) into reached
    from cali_session_guard.phase4_form_reachable(form.questions,new.answers);
  if not cali_session_guard.phase4_form_answers_valid(reached,new.answers) then
    raise exception using errcode='22023',message='Confira as respostas do caminho selecionado.';
  end if;
  if exists(select 1 from jsonb_array_elements(reached) q where q->>'kind'='file'
    and new.answers->>(q->>'id')='[PDF anexado]'
    and not exists(select 1 from cali_session_guard.phase4_form_pdfs a
      where a.response_id=new.id and a.question_id::text=q->>'id')) then
    raise exception using errcode='22023',message='Anexe o PDF antes de enviar.';
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_check_conditional_response()
  from public,anon,authenticated,service_role;
drop trigger if exists phase4_check_conditional_response on cali_workspace.form_responses;
create trigger phase4_check_conditional_response before insert on cali_workspace.form_responses
for each row execute function cali_session_guard.phase4_check_conditional_response();

create or replace function public.v2_submit_pilot_public_text_form(p_slug text,p_request_id uuid,p_answers jsonb)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  form cali_workspace.forms;
  signature bytea;
  previous bytea;
  result jsonb;
  reached jsonb;
  normalized jsonb:=p_answers;
  attachment_question text;
  pdf_text text;
  pdf bytea;
  response_id uuid;
  created_response_count integer;
begin
  if p_request_id is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>2896250 then
    raise exception using errcode='22023',message='Confira as respostas.';
  end if;
  perform 1 from cali_workspace.forms f where f.slug=p_slug and length(p_slug) between 1 and 100
    and f.id=(cali_session_guard.phase4_public_text_form(p_slug)).id for update;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  form:=cali_session_guard.phase4_public_text_form(p_slug);
  if form.id is null then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  signature:=sha256(convert_to(p_answers::text,'UTF8'));
  select r.fingerprint into previous from cali_session_guard.phase4_public_form_receipts r
    where r.form_id=form.id and r.request_id=p_request_id;
  if found then
    if previous=signature then return true; end if;
    raise exception using errcode='40001',message='Este envio já foi registrado.';
  end if;
  if form.status<>'open' then raise exception using errcode='42501',message='Coleta encerrada.'; end if;
  select coalesce(jsonb_agg(question),'[]'::jsonb) into reached
  from cali_session_guard.phase4_form_reachable(form.questions,p_answers);
  select q->>'id' into attachment_question from jsonb_array_elements(reached) q where q->>'kind'='file';
  if attachment_question is not null and p_answers?attachment_question then
    pdf_text:=p_answers->>attachment_question;
    if jsonb_typeof(p_answers->attachment_question) is distinct from 'string'
      or length(pdf_text) not between 12 and 2796204 then
      raise exception using errcode='22023',message='Selecione um PDF de até 2 MiB.';
    end if;
    pdf:=decode(pdf_text,'base64');
    if octet_length(pdf) not between 8 and 2097152 or substring(pdf from 1 for 5)<>convert_to('%PDF-','UTF8') then
      raise exception using errcode='22023',message='PDF inválido.';
    end if;
    normalized:=jsonb_set(normalized,array[attachment_question],'"[PDF anexado]"'::jsonb);
  end if;
  if octet_length(normalized::text)>100000 or not cali_session_guard.phase4_form_answers_valid(reached,normalized) then
    raise exception using errcode='22023',message='Confira as respostas.';
  end if;
  if pdf is not null then
    select count(*) into created_response_count from cali_workspace.form_responses r
      where r.form_id=form.id and r.submitted_at>statement_timestamp()-interval '1 minute';
    if created_response_count>=30 then
      raise exception using errcode='22023',message='Muitas respostas ao mesmo tempo. Tente de novo em instantes.';
    end if;
    response_id:=gen_random_uuid();
    insert into cali_session_guard.phase4_form_pdfs(response_id,question_id,bytes)
      values(response_id,attachment_question::uuid,pdf);
    insert into cali_workspace.form_responses(id,form_id,answers,respondent_name,respondent_email)
    values(response_id,form.id,
      coalesce((select jsonb_object_agg(q->>'id',case
          when q->>'kind'='email' then to_jsonb(lower(btrim(normalized->>(q->>'id'))))
          when q->>'kind' in ('name','phone') then to_jsonb(btrim(normalized->>(q->>'id')))
          else normalized->(q->>'id') end)
        from jsonb_array_elements(reached) q
        where normalized->(q->>'id') not in ('""'::jsonb,'[]'::jsonb)),'{}'::jsonb),
      (select btrim(normalized->>(q->>'id')) from jsonb_array_elements(reached) with ordinality as questions(q,position)
        where q->>'kind'='name' and nullif(btrim(normalized->>(q->>'id')),'') is not null order by position limit 1),
      (select lower(btrim(normalized->>(q->>'id'))) from jsonb_array_elements(reached) with ordinality as questions(q,position)
        where q->>'kind'='email' and nullif(btrim(normalized->>(q->>'id')),'') is not null order by position limit 1));
  else
    result:=public.cali_form_submit(form.slug,case
      when jsonb_path_exists(form.questions,'$[*].logic') then normalized||jsonb_build_object(
        '__visited',(select jsonb_agg(q->>'id') from jsonb_array_elements(reached) q))
      else normalized end);
    if result->>'ok' is distinct from 'true' then
      raise exception using errcode='22023',message='Não foi possível salvar as respostas.';
    end if;
  end if;
  insert into cali_session_guard.phase4_public_form_receipts values(form.id,p_request_id,signature);
  return true;
end;
$$;

revoke all on function public.v2_read_pilot_public_text_form(text),
  public.v2_submit_pilot_public_text_form(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.v2_read_pilot_public_text_form(text),
  public.v2_submit_pilot_public_text_form(text,uuid,jsonb) to anon,authenticated;
-- Preserva a projeção instalada e só acrescenta a capacidade de abrir o link.
do $$
declare
  definition text := pg_get_functiondef('cali_workspace.v2_list_pilot_forms(uuid,integer)'::regprocedure);
  previous text := 'select f.id,f.slug,f.title,f.status,f.created_at,';
  link_field constant text := 'as "publicTextLink",';
  opening_field constant text := 'as "publicOpeningAvailable",';
  eligible constant text := ' (f.status in (''draft'',''closed'') and cali_session_guard.phase4_form_public_eligible(f.company_id,f.id,f.slug,f.audience::text,f.confirm_email,f.questions)) '||opening_field;
  link_projection constant text := ' (f.status=''open'' and (cali_session_guard.phase4_public_text_form(f.slug)).id is not null) '||link_field;
begin
  if strpos(definition,opening_field)>0 then return; end if;
  if strpos(definition,link_field)=0 then
    if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
      raise exception 'Projeção de formulários mudou.';
    end if;
    definition:=replace(definition,previous,previous||link_projection);
  end if;
  if (length(definition)-length(replace(definition,link_field,'')))/length(link_field)<>1 then
    raise exception 'Projeção de abertura de formulários mudou.';
  end if;
  execute replace(definition,link_field,link_field||eligible);
end;
$$;
notify pgrst,'reload schema';
commit;
