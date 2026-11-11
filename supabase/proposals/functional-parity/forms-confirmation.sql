-- Aplicar após a validação do worker de confirmação e da URL configurada no ambiente.
begin;
set local lock_timeout='5s';

create or replace function cali_session_guard.phase4_form_public_eligible(
  p_company uuid,p_id uuid,p_slug text,p_audience text,p_confirm_email boolean,p_questions jsonb
) returns boolean language sql stable set search_path='' as $$
  select p_audience='client' and length(p_slug) between 1 and 100
    and (not p_confirm_email or (exists(select 1 from jsonb_array_elements(p_questions) q
      where q->>'kind'='email' and q->>'required'='true') and exists(select 1
      from cali_workspace.runtime_secrets where secret_key='forms_confirmation_url'
        and secret_value ~ '^https://[a-z0-9-]+[.]supabase[.]co/functions/v1/cali-forms-confirmation$')))
    and cali_session_guard.phase4_form_public_questions_valid(p_questions)
    and exists(select 1 from cali_workspace.activity_log l
      where l.company_id=p_company and l.entity_id=p_id and l.entity_type='form'
        and l.event_type='form_draft_created');
$$;
revoke all on function cali_session_guard.phase4_form_public_eligible(uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated,service_role;

create function cali_session_guard.queue_v2_form_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare endpoint text; hook text;
begin
  if new.respondent_email is null or new.confirmation_sent_at is not null
    or current_setting('cali.forms.restoring',true)='on' then return new; end if;
  if not exists(select 1 from cali_workspace.forms f where f.id=new.form_id and f.confirm_email
    and f.status='open' and cali_session_guard.phase4_form_public_eligible(
      f.company_id,f.id,f.slug,f.audience::text,f.confirm_email,f.questions)) then return new; end if;
  select secret_value into endpoint from cali_workspace.runtime_secrets where secret_key='forms_confirmation_url';
  select secret_value into hook from cali_workspace.runtime_secrets where secret_key='notification_email_hook';
  if endpoint ~ '^https://[a-z0-9-]+[.]supabase[.]co/functions/v1/cali-forms-confirmation$' and hook is not null then
    -- O provedor deduplica por ID da resposta, inclusive se o contrato legado já enfileirou o mesmo ID.
    perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-workspace-hook',hook),
      body:=jsonb_build_object('response_id',new.id));
  end if;
  return new;
end $$;
revoke all on function cali_session_guard.queue_v2_form_confirmation() from public,anon,authenticated,service_role;
create trigger v2_form_confirmation after insert on cali_workspace.form_responses
  for each row execute function cali_session_guard.queue_v2_form_confirmation();
notify pgrst,'reload schema';
commit;
