-- FLOW-17. Edição de rascunho sem respostas, preservando o JSON legado de cada pergunta.
begin;
set local lock_timeout = '5s';

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
        'id',q.item->>'id','label',q.item->>'label','kind',q.item->>'kind',
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
begin
  if p_action is null or p_action not in ('details','add_question','edit_question')
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
  else
    label := btrim(p_fields->>'label');
    if coalesce(length(label),0) not between 1 and 400
      or label ~ '[<>]' or jsonb_typeof(p_fields->'required') is distinct from 'boolean' then
      raise exception using errcode='22023',message='Confira o texto e a obrigatoriedade da pergunta.';
    end if;
    if p_action='add_question' then
      question_kind := p_fields->>'kind';
      if question_kind is null or question_kind not in ('short_text','long_text')
        or jsonb_array_length(next_questions)>=40 then
        raise exception using errcode='22023',message='Tipo ou limite de perguntas indisponível.';
      end if;
      question_id := gen_random_uuid()::text;
      next_questions := next_questions||jsonb_build_array(jsonb_build_object(
        'id',question_id,'kind',question_kind,'label',label,'required',p_fields->'required'));
    else
      question_id := p_fields->>'id';
      if (select count(*) from jsonb_array_elements(next_questions) q where q->>'id'=question_id)<>1
        or not exists(select 1 from jsonb_array_elements(next_questions) q
          where q->>'id'=question_id and q->>'kind' in ('short_text','long_text')) then
        raise exception using errcode='22023',message='Pergunta indisponível para editar.';
      end if;
      select jsonb_agg(case when q.item->>'id'=question_id then q.item||jsonb_build_object(
        'label',label,'required',p_fields->'required') else q.item end order by q.position)
      into next_questions from jsonb_array_elements(next_questions) with ordinality q(item,position);
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
