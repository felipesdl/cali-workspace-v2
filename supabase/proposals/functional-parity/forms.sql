-- Instalação explícita após conferir os contratos do ambiente. Não executado automaticamente.
begin;
set local lock_timeout='5s';

create table cali_session_guard.form_trash_pdfs (
  entry_id uuid primary key references cali_workspace.forms_trash(id) on delete cascade,
  attachments jsonb not null
);
alter table cali_session_guard.form_trash_pdfs enable row level security;
revoke all on cali_session_guard.form_trash_pdfs from public,anon,authenticated,service_role;


create function cali_session_guard.require_form_admin(p_company uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true'
    or not exists(select 1 from cali_workspace.profiles p where p.id=auth.uid() and p.active and p.role='admin')
    or not exists(select 1 from cali_workspace.companies c where c.id=p_company) then
    raise exception using errcode='42501',message='Gestão de formulário indisponível.';
  end if;
end $$;
revoke all on function cali_session_guard.require_form_admin(uuid) from public,anon,authenticated,service_role;

create function cali_workspace.v2_form_options(p_company uuid,p_form uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f cali_workspace.forms;
begin
  perform cali_session_guard.require_form_admin(p_company);
  select * into f from cali_workspace.forms where id=p_form and company_id=p_company;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  return jsonb_build_object('confirmEmail',f.confirm_email,'updatedAt',f.updated_at);
end $$;

create function cali_workspace.v2_set_form_confirmation(p_company uuid,p_form uuid,p_expected timestamptz,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare f cali_workspace.forms;
begin
  perform cali_session_guard.require_form_admin(p_company);
  select * into f from cali_workspace.forms where id=p_form and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  if f.confirm_email=p_enabled then return; end if;
  if f.updated_at is distinct from p_expected then raise exception using errcode='40001',message='Formulário mudou.'; end if;
  if f.status='open' or p_enabled is null or (p_enabled and not exists(
    select 1 from jsonb_array_elements(f.questions) q where q->>'kind'='email' and q->>'required'='true')) then
    raise exception using errcode='22023',message='Encerre a coleta e inclua uma pergunta obrigatória de e-mail.';
  end if;
  if p_enabled and not exists(select 1 from cali_workspace.runtime_secrets where secret_key='forms_confirmation_url'
    and secret_value ~ '^https://[a-z0-9-]+[.]supabase[.]co/functions/v1/cali-forms-confirmation$') then
    raise exception using errcode='22023',message='Canal de confirmação ainda não configurado.';
  end if;
  update cali_workspace.forms set confirm_email=p_enabled,updated_at=clock_timestamp() where id=p_form;
end $$;

create function cali_workspace.v2_list_form_trash(p_company uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform cali_session_guard.require_form_admin(p_company);
  if p_page is null or p_page not between 1 and 10000 then raise exception using errcode='22023',message='Página inválida.'; end if;
  return coalesce((select jsonb_agg(item order by deleted_at desc,id) from (
    select t.id,t.deleted_at,jsonb_build_object('id',t.id,'title',t.form_title,'kind',t.kind,
      'deletedAt',t.deleted_at,'responseCount',jsonb_array_length(t.responses)) item
    from cali_workspace.forms_trash t where t.restored_at is null and t.deleted_at>now()-interval '30 days'
      and coalesce(t.form->>'company_id',(select f.company_id::text from cali_workspace.forms f where f.id=t.form_id))=p_company::text
    order by t.deleted_at desc,t.id limit 25 offset (p_page-1)*25
  ) rows),'[]'::jsonb);
end $$;

create function cali_workspace.v2_trash_form(p_company uuid,p_form uuid,p_expected timestamptz,p_title text) returns uuid
language plpgsql security definer set search_path='' as $$
declare f cali_workspace.forms; pdfs jsonb;
begin
  perform cali_session_guard.require_form_admin(p_company);
  select * into f from cali_workspace.forms where id=p_form and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  if f.updated_at is distinct from p_expected then raise exception using errcode='40001',message='Formulário mudou.'; end if;
  if p_title is distinct from f.title then raise exception using errcode='22023',message='Confira o nome do formulário.'; end if;
  -- O gatilho original preserva formulário e respostas na mesma transação.
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='cali_workspace.forms'::regclass
    and tgname='forms_trash_form' and tgenabled in ('O','A')) then
    raise exception using errcode='55000',message='Lixeira não configurada.';
  end if;
  select jsonb_agg(to_jsonb(a)) into pdfs from cali_session_guard.phase4_form_pdfs a
    join cali_workspace.form_responses r on r.id=a.response_id where r.form_id=p_form;
  delete from cali_workspace.forms where id=p_form;
  if pdfs is not null then
    insert into cali_session_guard.form_trash_pdfs values((select id from cali_workspace.forms_trash
      where form_id=p_form and kind='form' and restored_at is null order by deleted_at desc,id limit 1),pdfs);
  end if;
  return p_form;
end $$;

create function cali_workspace.v2_trash_form_response(p_company uuid,p_form uuid,p_response uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare pdfs jsonb;
begin
  perform cali_session_guard.require_form_admin(p_company);
  perform 1 from cali_workspace.forms where id=p_form and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Formulário indisponível.'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='cali_workspace.form_responses'::regclass
    and tgname='forms_trash_responses' and tgenabled in ('O','A')) then
    raise exception using errcode='55000',message='Lixeira não configurada.';
  end if;
  select jsonb_agg(to_jsonb(a)) into pdfs from cali_session_guard.phase4_form_pdfs a where a.response_id=p_response;
  delete from cali_workspace.form_responses where id=p_response and form_id=p_form;
  if not found then raise exception using errcode='42501',message='Resposta indisponível.'; end if;
  if pdfs is not null then
    insert into cali_session_guard.form_trash_pdfs values((select id from cali_workspace.forms_trash
      where form_id=p_form and kind='responses' and restored_at is null
        and responses @> jsonb_build_array(jsonb_build_object('id',p_response)) order by deleted_at desc,id limit 1),pdfs);
  end if;
  return p_response;
end $$;

create function cali_workspace.v2_restore_form(p_company uuid,p_entry uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t cali_workspace.forms_trash; scope text;
begin
  perform cali_session_guard.require_form_admin(p_company);
  select * into t from cali_workspace.forms_trash where id=p_entry for update;
  scope:=coalesce(t.form->>'company_id',(select f.company_id::text from cali_workspace.forms f where f.id=t.form_id));
  if not found or scope is distinct from p_company::text or t.deleted_at<=now()-interval '30 days' then
    raise exception using errcode='42501',message='Item indisponível para restauração.';
  end if;
  if t.restored_at is not null then return t.form_id; end if;
  if t.kind='form' then
    -- Restauração não reabre uma coleta pública por acidente.
    update cali_workspace.forms_trash set form=jsonb_set(form,'{status}','"closed"') where id=p_entry;
  end if;
  perform set_config('cali.forms.restoring','on',true);
  perform public.cali_forms_trash_restore(p_entry);
  perform set_config('cali.forms.restoring','off',true);
  insert into cali_session_guard.phase4_form_pdfs
    select a.* from cali_session_guard.form_trash_pdfs p,
      lateral jsonb_populate_recordset(null::cali_session_guard.phase4_form_pdfs,p.attachments) a
    where p.entry_id=p_entry on conflict(response_id) do nothing;
  delete from cali_session_guard.form_trash_pdfs where entry_id=p_entry;
  return t.form_id;
end $$;

revoke all on function cali_workspace.v2_form_options(uuid,uuid),
  cali_workspace.v2_set_form_confirmation(uuid,uuid,timestamptz,boolean),
  cali_workspace.v2_list_form_trash(uuid,integer),
  cali_workspace.v2_trash_form(uuid,uuid,timestamptz,text),cali_workspace.v2_trash_form_response(uuid,uuid,uuid),cali_workspace.v2_restore_form(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_form_options(uuid,uuid),
  cali_workspace.v2_set_form_confirmation(uuid,uuid,timestamptz,boolean),
  cali_workspace.v2_list_form_trash(uuid,integer),
  cali_workspace.v2_trash_form(uuid,uuid,timestamptz,text),cali_workspace.v2_trash_form_response(uuid,uuid,uuid),cali_workspace.v2_restore_form(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
