-- FLOW-17. Edição de rascunho sem respostas, preservando o JSON legado de cada pergunta.
begin;
set local lock_timeout = '5s';

create or replace function cali_session_guard.phase4_form_options_valid(p_kind text,p_options jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case
    when p_kind not in ('single_choice','multi_choice') then p_options is null
    when jsonb_typeof(p_options) is distinct from 'array' then false
    else jsonb_array_length(p_options) between (case when p_kind='multi_choice' then 2 else 1 end) and 26
      and not exists(select 1 from jsonb_array_elements(p_options) item
        where jsonb_typeof(item)<>'string' or length(item#>>'{}') not between 1 and 300
          or item#>>'{}'<>btrim(item#>>'{}'))
      and (select count(distinct item) from jsonb_array_elements(p_options) item)=jsonb_array_length(p_options)
  end;
$$;
revoke all on function cali_session_guard.phase4_form_options_valid(text,jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_form_scale_valid(p_question jsonb)
returns boolean language sql immutable set search_path='' as $$
  select case
    when p_question->>'kind' is distinct from 'scale'
      then not (p_question ?| array['scaleMin','scaleMax','minLabel','maxLabel'])
    when (p_question?'scaleMin' and jsonb_typeof(p_question->'scaleMin') is distinct from 'number')
      or (p_question?'scaleMax' and jsonb_typeof(p_question->'scaleMax') is distinct from 'number')
      then false
    else coalesce((p_question->>'scaleMin')::numeric,0)>=0
      and coalesce((p_question->>'scaleMax')::numeric,10)<=10
      and coalesce((p_question->>'scaleMin')::numeric,0)<coalesce((p_question->>'scaleMax')::numeric,10)
      and trunc((p_question->>'scaleMin')::numeric) is not distinct from (p_question->>'scaleMin')::numeric
      and trunc((p_question->>'scaleMax')::numeric) is not distinct from (p_question->>'scaleMax')::numeric
      and (not p_question?'minLabel' or (jsonb_typeof(p_question->'minLabel')='string'
        and length(p_question->>'minLabel')<=80 and p_question->>'minLabel' !~ '[<>]'))
      and (not p_question?'maxLabel' or (jsonb_typeof(p_question->'maxLabel')='string'
        and length(p_question->>'maxLabel')<=80 and p_question->>'maxLabel' !~ '[<>]'))
  end;
$$;
revoke all on function cali_session_guard.phase4_form_scale_valid(jsonb)
  from public,anon,authenticated,service_role;

-- Regras do editor legado: por alternativa, avançar para uma pergunta posterior ou encerrar.
create or replace function cali_session_guard.phase4_form_logic_valid(p_questions jsonb)
returns boolean language sql immutable set search_path='' as $$
  select not exists (
    select 1 from jsonb_array_elements(p_questions) with ordinality q(item,position)
    where q.item?'logic' and case
      when q.item->>'kind' not in ('single_choice','yes_no')
        or jsonb_typeof(q.item->'logic') is distinct from 'array' then true
      else jsonb_array_length(q.item->'logic') not between 1 and 26
        or (select count(distinct rule->>'when') from jsonb_array_elements(q.item->'logic') rule)
          <>jsonb_array_length(q.item->'logic')
        or exists(select 1 from jsonb_array_elements(q.item->'logic') rule where case
          when jsonb_typeof(rule) is distinct from 'object' then true
          else rule-'when'-'goTo'<>'{}'::jsonb
            or jsonb_typeof(rule->'when') is distinct from 'string'
            or not coalesce((case when q.item->>'kind'='yes_no' then '["Sim","Não"]'::jsonb
              else q.item->'options' end) @> jsonb_build_array(rule->'when'),false)
            or jsonb_typeof(rule->'goTo') is distinct from 'string'
            or (rule->>'goTo'<>'__end' and not exists(
              select 1 from jsonb_array_elements(p_questions) with ordinality target(item,position)
              where target.position>q.position and target.item->>'id'=rule->>'goTo'))
          end)
      end
  );
$$;
revoke all on function cali_session_guard.phase4_form_logic_valid(jsonb)
  from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_create_pilot_form_draft(
  p_company_id uuid,p_form_id uuid,p_slug text,p_title text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  title text := btrim(p_title);
  slug text := lower(btrim(p_slug));
  fingerprint bytea;
  previous uuid;
begin
  if coalesce(length(title),0) not between 1 and 160 or coalesce(length(slug),0) not between 3 and 60
    or title ~ '[<>]' or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode='22023',message='Confira o título e o endereço do formulário.';
  end if;
  fingerprint := sha256(convert_to(jsonb_build_array('form-draft',title,slug)::text,'UTF8'));
  previous := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_form_id,fingerprint);
  if previous is not null then return previous; end if;
  insert into cali_workspace.forms(id,company_id,slug,title,status,questions,confirm_email,audience,created_by)
  values(p_form_id,p_company_id,slug,title,'draft','[]',false,'client',actor);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_draft_created','form',p_form_id,'{}');
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_form_id,fingerprint,p_form_id);
  return p_form_id;
end;
$$;

create or replace function cali_workspace.v2_read_pilot_form_draft(p_company_id uuid,p_form_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  return (
    select jsonb_build_object('id',f.id,'title',f.title,'description',f.description,'updatedAt',f.updated_at,
      'questions',coalesce((select jsonb_agg(jsonb_build_object(
        'id',q.item->>'id','label',q.item->>'label','kind',q.item->>'kind','options',q.item->'options','logic',q.item->'logic',
        'scaleMin',q.item->'scaleMin','scaleMax',q.item->'scaleMax','minLabel',q.item->'minLabel','maxLabel',q.item->'maxLabel',
        'required',coalesce(q.item->'required'='true'::jsonb,false)) order by q.position)
        from jsonb_array_elements(f.questions) with ordinality q(item,position)
        where nullif(q.item->>'id','') is not null and q.item->>'kind' is not null
          and q.item->>'label' is not null),'[]'::jsonb))
    from cali_workspace.forms f where f.id=p_form_id and f.company_id=p_company_id and f.status='draft'
      and not exists(select 1 from cali_workspace.form_responses r where r.form_id=f.id)
  );
end;
$$;

create or replace function cali_workspace.v2_edit_pilot_form_draft(
  p_company_id uuid,p_form_id uuid,p_expected timestamptz,p_action text,p_fields jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  form cali_workspace.forms%rowtype;
  next_title text;
  next_description text;
  next_questions jsonb;
  label text;
  question_kind text;
  question_id text;
  new_question jsonb;
  scale_fields jsonb;
begin
  if p_action is null or p_action not in ('details','add_question','edit_question','set_logic')
    or p_expected is null or jsonb_typeof(p_fields) is distinct from 'object' then
    raise exception using errcode='22023',message='Confira os dados do formulário.';
  end if;
  select f.* into form from cali_workspace.forms f
  where f.id=p_form_id and f.company_id=p_company_id for update;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  if form.status<>'draft' or form.updated_at is distinct from p_expected
    or exists(select 1 from cali_workspace.form_responses r where r.form_id=form.id) then
    raise exception using errcode='40001',message='O formulário mudou ou já recebeu respostas.';
  end if;
  next_title := form.title;
  next_description := form.description;
  next_questions := form.questions;
  if p_action='details' then
    next_title := btrim(p_fields->>'title');
    next_description := coalesce(btrim(p_fields->>'description'),'');
    if coalesce(length(next_title),0) not between 1 and 160 or length(next_description)>1200
      or next_title ~ '[<>]' or next_description ~ '[<>]' then
      raise exception using errcode='22023',message='Confira o título e a descrição.';
    end if;
  elsif p_action='set_logic' then
    question_id := p_fields->>'id';
    if jsonb_typeof(p_fields->'logic') is distinct from 'array'
      or not exists(select 1 from jsonb_array_elements(next_questions) q
        where q->>'id'=question_id and q->>'kind' in ('single_choice','yes_no')) then
      raise exception using errcode='22023',message='Confira a regra da pergunta.';
    end if;
    select jsonb_agg(case when q.item->>'id' is distinct from question_id then q.item
      when p_fields->'logic'='[]'::jsonb then q.item-'logic'
      else q.item||jsonb_build_object('logic',p_fields->'logic') end order by q.position)
    into next_questions from jsonb_array_elements(next_questions) with ordinality q(item,position);
    if not cali_session_guard.phase4_form_logic_valid(next_questions) then
      raise exception using errcode='22023',message='Confira as alternativas e os destinos da pergunta.';
    end if;
  else
    label := btrim(p_fields->>'label');
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into scale_fields
      from jsonb_each(p_fields) where key in ('scaleMin','scaleMax','minLabel','maxLabel');
    if coalesce(length(label),0) not between 1 and 400
      or label ~ '[<>]' or jsonb_typeof(p_fields->'required') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Confira o texto e a obrigatoriedade da pergunta.';
    end if;
    if p_action='add_question' then
      question_kind := p_fields->>'kind';
      if question_kind is null or question_kind not in ('name','email','phone','short_text','long_text','number','date','single_choice','multi_choice','yes_no','scale','statement','file')
        or jsonb_array_length(next_questions)>=40
        or (question_kind='file' and jsonb_path_exists(next_questions,'$[*] ? (@.kind == "file")')) then
        raise exception using errcode='22023',message='Tipo ou limite de perguntas indisponível.';
      end if;
      question_id := gen_random_uuid()::text;
      new_question:=jsonb_build_object('id',question_id,'kind',question_kind,'label',label,
        'required',question_kind<>'statement' and p_fields->'required'='true'::jsonb)||scale_fields;
      if not cali_session_guard.phase4_form_options_valid(question_kind,p_fields->'options') then
        raise exception using errcode='22023',message='Confira as opções da pergunta.';
      end if;
      if p_fields?'options' then new_question:=new_question||jsonb_build_object('options',p_fields->'options'); end if;
      next_questions:=next_questions||jsonb_build_array(new_question);
    else
      question_id := p_fields->>'id';
      if (select count(*) from jsonb_array_elements(next_questions) q where q->>'id'=question_id)<>1
        or not exists(select 1 from jsonb_array_elements(next_questions) q
          where q->>'id'=question_id and q->>'kind' in ('name','email','phone','short_text','long_text','number','date','single_choice','multi_choice','yes_no','scale','statement','file')) then
        raise exception using errcode='22023',message='Pergunta indisponível para editar.';
      end if;
      select q->>'kind' into question_kind from jsonb_array_elements(next_questions) q where q->>'id'=question_id;
      new_question:=jsonb_build_object('label',label,
        'required',question_kind<>'statement' and p_fields->'required'='true'::jsonb)||scale_fields;
      if p_fields?'options' then
        if not cali_session_guard.phase4_form_options_valid(question_kind,p_fields->'options') then
          raise exception using errcode='22023',message='Confira as opções da pergunta.';
        end if;
        if exists(select 1 from jsonb_array_elements(next_questions) q
          cross join lateral jsonb_array_elements(case when jsonb_typeof(q->'logic')='array'
            then q->'logic' else '[]'::jsonb end) rule
          where q->>'id'=question_id and not (p_fields->'options' @> jsonb_build_array(rule->'when'))) then
          raise exception using errcode='P4F03',message='Remova a regra da alternativa antes de excluir a opção.';
        end if;
        new_question:=new_question||jsonb_build_object('options',p_fields->'options');
      end if;
      select jsonb_agg(case when q.item->>'id'=question_id then q.item||new_question
        else q.item end order by q.position)
      into next_questions from jsonb_array_elements(next_questions) with ordinality q(item,position);
    end if;
    if exists(select 1 from jsonb_array_elements(next_questions) q
      where q->>'id'=question_id and not cali_session_guard.phase4_form_scale_valid(q)) then
      raise exception using errcode='22023',message='Confira os limites e os rótulos da escala.';
    end if;
  end if;
  update cali_workspace.forms set title=next_title,description=next_description,
    questions=next_questions,updated_at=clock_timestamp() where id=form.id;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'form_draft_edited','form',form.id,jsonb_build_object('action',p_action,'questionId',question_id));
  return form.id;
end;
$$;

revoke all on function cali_workspace.v2_create_pilot_form_draft(uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_form_draft(uuid,uuid),
  cali_workspace.v2_edit_pilot_form_draft(uuid,uuid,timestamptz,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_create_pilot_form_draft(uuid,uuid,text,text),
  cali_workspace.v2_read_pilot_form_draft(uuid,uuid),
  cali_workspace.v2_edit_pilot_form_draft(uuid,uuid,timestamptz,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
