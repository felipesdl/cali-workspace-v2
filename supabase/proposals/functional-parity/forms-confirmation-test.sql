-- PostgreSQL descartável. O transporte registra chamadas em tabela, sem usar rede.
create role anon;
create role authenticated;
create role service_role;
create schema cali_workspace;
create schema cali_session_guard;
create schema vault;
create schema net;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table cali_workspace.runtime_secrets(secret_key text,secret_value text);
create table cali_workspace.activity_log(company_id uuid,entity_id uuid,entity_type text,event_type text);
create table cali_workspace.forms(id uuid primary key,slug text,status text,confirm_email boolean,thank_you text);
create table cali_workspace.form_responses(
  id uuid default gen_random_uuid() primary key,form_id uuid,answers jsonb,respondent_name text,respondent_email text,
  confirmation_sent_at timestamptz
);
create table net.sent(id bigint generated always as identity,url text,headers jsonb,body jsonb);
create function net.http_post(url text,headers jsonb,body jsonb) returns bigint
language plpgsql as $$
declare request bigint;
begin
  if current_setting('cali.test.fail_transport',true)='on' then raise exception 'Falha sintética'; end if;
  insert into net.sent(url,headers,body) values(url,headers,body) returning id into request;
  return request;
end $$;
create function cali_session_guard.phase4_form_public_questions_valid(jsonb)
returns boolean language sql stable as $$ select true; $$;
create function cali_session_guard.phase4_form_public_eligible(
  p_company uuid,p_id uuid,p_slug text,p_audience text,p_confirm_email boolean,p_questions jsonb
) returns boolean language sql stable as $$ select not p_confirm_email; $$;

create function public.cali_form_submit(p_slug text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_form cali_workspace.forms;
  v_email text:=p_answers->>'email';
  v_clean jsonb:=p_answers;
  v_name text;
  v_id uuid;
  v_hook text;
  v_recent integer;
begin
  select * into strict v_form from cali_workspace.forms where slug=p_slug;
  insert into cali_workspace.form_responses (form_id, answers, respondent_name, respondent_email)
  values (v_form.id, v_clean, v_name, v_email) returning id into v_id;
  if v_form.confirm_email and v_email is not null then
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
  return jsonb_build_object('ok', true, 'thank_you', v_form.thank_you, 'confirmation', v_form.confirm_email and v_email is not null);
end $$;

\ir forms-confirmation.sql

insert into cali_workspace.forms values
  ('10000000-0000-4000-8000-000000000001','legado','open',true,null),
  ('10000000-0000-4000-8000-000000000002','v2','open',true,null);
insert into cali_workspace.runtime_secrets values
  ('forms_confirmation_url','https://homolog.supabase.co/functions/v1/cali-forms-confirmation'),
  ('notification_email_hook','hook-fixture');

do $$
begin
  assert public.cali_form_submit('legado','{"email":"teste@example.test"}')->>'confirmation'='false';
  assert not exists(select 1 from net.sent);
end $$;
insert into vault.decrypted_secrets values ('cali_forms_confirmation_bearer','token.assinado.fixture');
update cali_workspace.runtime_secrets
  set secret_value='https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/cali-forms-confirmation'
  where secret_key='forms_confirmation_url';
do $$
begin
  assert public.cali_form_submit('legado','{"email":"destino-invalido@example.test"}')->>'confirmation'='false';
  assert not exists(select 1 from net.sent);
end $$;
update cali_workspace.runtime_secrets
  set secret_value='https://homolog.supabase.co/functions/v1/cali-forms-confirmation'
  where secret_key='forms_confirmation_url';
do $$
declare
  saved uuid;
begin
  assert public.cali_form_submit('legado','{"email":"teste@example.test"}')->>'confirmation'='true';
  assert (select count(*) from net.sent)=1;
  assert (select url from net.sent)='https://homolog.supabase.co/functions/v1/cali-forms-confirmation';
  assert (select headers->>'Authorization' from net.sent)='Bearer token.assinado.fixture';
  insert into cali_workspace.form_responses(form_id,answers,respondent_email)
    values('10000000-0000-4000-8000-000000000002','{}','fixture-importada@example.test');
  assert (select count(*) from net.sent)=1;
  perform set_config('cali.forms.public_submit','on',true);
  insert into cali_workspace.form_responses(form_id,answers,respondent_email)
    values('10000000-0000-4000-8000-000000000002','{}','teste@example.test') returning id into saved;
  assert (select count(*) from net.sent where body->>'response_id'=saved::text)=1;

  perform set_config('cali.forms.restoring','on',true);
  insert into cali_workspace.form_responses(form_id,answers,respondent_email)
    values('10000000-0000-4000-8000-000000000002','{}','restore@example.test');
  perform set_config('cali.forms.restoring','off',true);
  perform set_config('cali.forms.public_submit','off',true);
  assert (select count(*) from net.sent)=2;

  perform set_config('cali.test.fail_transport','on',true);
  assert public.cali_form_submit('legado','{"email":"falha@example.test"}')->>'confirmation'='false';
  assert exists(select 1 from cali_workspace.form_responses r
    join cali_session_guard.form_confirmation_requests q on q.response_id=r.id
    where r.respondent_email='falha@example.test' and q.request_id is null);
  assert not has_function_privilege('anon','cali_session_guard.form_confirmation_transport()','EXECUTE');
end $$;

\ir forms-confirmation-rollback.sql
do $$
begin
  assert (select count(*) from cali_session_guard.form_confirmation_requests)=3;
  assert pg_get_functiondef('public.cali_form_submit(text,jsonb)'::regprocedure) like '%net.http_post%';
end $$;
