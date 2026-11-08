-- FLOW-17. Coleta pública V2 para formulários de texto abertos explicitamente no piloto.
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

create or replace function cali_session_guard.phase4_public_text_form(p_slug text)
returns cali_workspace.forms language sql stable set search_path=''
as $$
  select f from cali_workspace.forms f
  join cali_session_guard.pilot_companies p on p.company_id=f.company_id
  where f.slug=p_slug and length(p_slug) between 1 and 100
    and f.status in ('open','closed') and f.audience='client' and not f.confirm_email
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=f.company_id and l.entity_id=f.id and l.entity_type='form'
        and l.event_type='form_draft_created')
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=f.company_id and l.entity_id=f.id and l.entity_type='form'
        and l.event_type='form_open' and l.metadata->>'collection'='public_link')
    and jsonb_array_length(f.questions) between 1 and 40
    and not exists(select 1 from jsonb_array_elements(f.questions) q
      where coalesce(q->>'kind','') not in ('short_text','long_text','number','date','single_choice','multi_choice','yes_no')
        or coalesce(q->>'id','') !~ '^[0-9a-f-]{36}$'
        or coalesce(length(q->>'label'),0) not between 1 and 400
        or jsonb_typeof(q->'required') is distinct from 'boolean'
        or not cali_session_guard.phase4_form_options_valid(q->>'kind',q->'options')
        or q-'id'-'kind'-'label'-'required'-'options'<>'{}'::jsonb);
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

create or replace function public.v2_submit_pilot_public_text_form(p_slug text,p_request_id uuid,p_answers jsonb)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  form cali_workspace.forms;
  signature bytea;
  previous bytea;
  result jsonb;
begin
  if p_request_id is null or jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text)>100000 then
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
  if exists(select 1 from jsonb_each(p_answers) as a(key,value)
    where not exists(select 1 from jsonb_array_elements(form.questions) q where q->>'id'=a.key)) then
    raise exception using errcode='22023',message='Confira as respostas.';
  end if;
  if exists(
    select 1 from jsonb_array_elements(form.questions) q
    cross join lateral (select p_answers->(q->>'id') as value) a
    where case
      when a.value is null or a.value='""'::jsonb
        then q->'required'='true'::jsonb
      when q->>'kind'='number' then jsonb_typeof(a.value)<>'number'
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
  ) then raise exception using errcode='22023',message='Confira as respostas.'; end if;
  result:=public.cali_form_submit(form.slug,p_answers);
  if result->>'ok' is distinct from 'true' then
    raise exception using errcode='22023',message='Não foi possível salvar as respostas.';
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
  next text := previous||' (f.status=''open'' and (cali_session_guard.phase4_public_text_form(f.slug)).id is not null) as "publicTextLink",';
begin
  if strpos(definition,next)>0 then return; end if;
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 then
    raise exception 'Projeção de formulários mudou.';
  end if;
  execute replace(definition,previous,next);
end;
$$;
notify pgrst,'reload schema';
commit;
