-- Instalar em ambiente reconciliado. Sem URL, hook e Vault, nenhum envio sai.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.form_confirmation_requests (
  response_id uuid primary key,
  requested_at timestamptz not null default clock_timestamp(),
  request_id bigint
);
create table cali_session_guard.form_confirmation_preimage (
  name text primary key, definition text not null
);
alter table cali_session_guard.form_confirmation_requests enable row level security;
alter table cali_session_guard.form_confirmation_preimage enable row level security;
revoke all on cali_session_guard.form_confirmation_requests,cali_session_guard.form_confirmation_preimage
  from public,anon,authenticated,service_role;

create function cali_session_guard.form_confirmation_transport() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare endpoint text; hook text; bearer text;
begin
  select secret_value into endpoint from cali_workspace.runtime_secrets where secret_key='forms_confirmation_url';
  select secret_value into hook from cali_workspace.runtime_secrets where secret_key='notification_email_hook';
  if endpoint is null or endpoint !~ '^https://[a-z0-9-]+[.]supabase[.]co/functions/v1/cali-forms-confirmation$'
    or endpoint='https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/cali-forms-confirmation'
    or nullif(hook,'') is null or to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1' into bearer using 'cali_forms_confirmation_bearer';
  if bearer is null or bearer !~ '^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' then return null; end if;
  return jsonb_build_object('endpoint',endpoint,'hook',hook,'bearer',bearer);
end $$;

create function cali_session_guard.form_confirmation_requested(p_response uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from cali_session_guard.form_confirmation_requests
    where response_id=p_response and request_id is not null);
$$;

insert into cali_session_guard.form_confirmation_preimage
values ('eligibility',pg_get_functiondef('cali_session_guard.phase4_form_public_eligible(uuid,uuid,text,text,boolean,jsonb)'::regprocedure));

create or replace function cali_session_guard.phase4_form_public_eligible(
  p_company uuid,p_id uuid,p_slug text,p_audience text,p_confirm_email boolean,p_questions jsonb
) returns boolean language sql stable set search_path='' as $$
  select p_audience='client' and length(p_slug) between 1 and 100
    and (not p_confirm_email or (exists(select 1 from jsonb_array_elements(p_questions) q
      where q->>'kind'='email' and q->>'required'='true')
      and cali_session_guard.form_confirmation_transport() is not null))
    and cali_session_guard.phase4_form_public_questions_valid(p_questions)
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=p_company and l.entity_id=p_id and l.entity_type='form'
        and l.event_type='form_draft_created');
$$;

create function cali_session_guard.queue_v2_form_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare transport jsonb; request bigint;
begin
  if current_setting('cali.forms.public_submit',true) is distinct from 'on'
    or new.respondent_email is null or new.confirmation_sent_at is not null
    or current_setting('cali.forms.restoring',true)='on' then return new; end if;
  if not exists(select 1 from cali_workspace.forms f where f.id=new.form_id and f.confirm_email
    and f.status='open') then return new; end if;
  if (select count(*) from cali_workspace.form_responses r where r.respondent_email=new.respondent_email
    and r.confirmation_sent_at>now()-interval '1 day')>=5 then return new; end if;
  transport:=cali_session_guard.form_confirmation_transport();
  if transport is null then return new; end if;
  insert into cali_session_guard.form_confirmation_requests(response_id) values(new.id)
    on conflict(response_id) do nothing;
  if not found then return new; end if;
  begin
    request:=net.http_post(url:=transport->>'endpoint',headers:=jsonb_build_object(
        'Content-Type','application/json','x-workspace-hook',transport->>'hook',
        'Authorization','Bearer '||(transport->>'bearer')),
      body:=jsonb_build_object('response_id',new.id));
    update cali_session_guard.form_confirmation_requests set request_id=request where response_id=new.id;
  exception when others then
    -- Uma falha de transporte fica para reconciliação sem invalidar a resposta.
    null;
  end;
  return new;
end $$;

-- Substitui somente o efeito externo conhecido, mantendo a validação e a escrita legadas.
do $migration$
declare
  current_definition text:=pg_get_functiondef('public.cali_form_submit(text,jsonb)'::regprocedure);
  legacy_send constant text:=$legacy$  if v_form.confirm_email and v_email is not null then
    select count(*) into v_recent from cali_workspace.form_responses
     where respondent_email = v_email and confirmation_sent_at > now() - interval '1 day';
    if v_recent < 5 then
      select secret_value into v_hook from cali_workspace.runtime_secrets where secret_key = 'notification_email_hook';
      if v_hook is not null then
        perform net.http_post(
          url := 'https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/cali-forms-confirmation',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-workspace-hook', v_hook),
          body := jsonb_build_object('response_id', v_id));
      end if;
    end if;
  end if;
$legacy$;
  legacy_receipt constant text:=$legacy$'confirmation', v_form.confirm_email and v_email is not null);$legacy$;
  legacy_insert constant text:=$legacy$  insert into cali_workspace.form_responses (form_id, answers, respondent_name, respondent_email)
  values (v_form.id, v_clean, v_name, v_email) returning id into v_id;$legacy$;
  replacement text;
begin
  if (length(current_definition)-length(replace(current_definition,legacy_send,'')))/length(legacy_send)<>1
    or (length(current_definition)-length(replace(current_definition,legacy_receipt,'')))/length(legacy_receipt)<>1
    or (length(current_definition)-length(replace(current_definition,legacy_insert,'')))/length(legacy_insert)<>1 then
    raise exception 'Contrato de confirmação legado mudou. Compare a preimagem antes de aplicar.';
  end if;
  replacement:=replace(replace(current_definition,legacy_send,''),legacy_receipt,
    $new$'confirmation', cali_session_guard.form_confirmation_requested(v_id));$new$);
  replacement:=replace(replacement,legacy_insert,
    '  perform set_config(''cali.forms.public_submit'',''on'',true);'||chr(10)||legacy_insert||chr(10)||
    '  perform set_config(''cali.forms.public_submit'',''off'',true);');
  if replacement ~* 'net[.]http_post' then
    raise exception 'O escritor legado ainda tem outro transporte de confirmação.';
  end if;
  insert into cali_session_guard.form_confirmation_preimage values('legacy',current_definition);
  execute replacement;
end $migration$;

revoke all on function cali_session_guard.form_confirmation_transport(),
  cali_session_guard.form_confirmation_requested(uuid),cali_session_guard.queue_v2_form_confirmation(),
  cali_session_guard.phase4_form_public_eligible(uuid,uuid,text,text,boolean,jsonb)
  from public,anon,authenticated,service_role;
create trigger v2_form_confirmation after insert on cali_workspace.form_responses
  for each row execute function cali_session_guard.queue_v2_form_confirmation();
notify pgrst,'reload schema';
commit;
