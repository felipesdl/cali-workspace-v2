-- ADAPTER EXCLUSIVO DA BASELINE LOCAL CONHECIDA. NÃO APLICADO.
-- Não supõe que cali_private.workspace_access_codes exista no hospedado.
-- Ordem revisável: candidata, reconciliação, login-admission e este adapter.
begin;
do $$ begin
  if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
     or current_setting('cali.session_cut_test',true) is distinct from 'isolated-only'
     or current_user <> 'postgres'
     or current_database() not like 'cali_session_cut_%' then
    raise exception 'Adapter restrito à cópia isolada autorizada';
  end if;
end $$;
create function cali_workspace.consume_workspace_code_v2(p_email text,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item cali_private.workspace_access_codes; profile_role text; authorization_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)),29120000));
  select * into item from cali_private.workspace_access_codes
    where email=lower(btrim(p_email)) and used_at is null order by created_at desc limit 1 for update;
  if item.id is null or item.delivery<>'delivered' or item.expires_at<=clock_timestamp()
     or item.attempts>=5 then return null; end if;
  update cali_private.workspace_access_codes set attempts=attempts+1 where id=item.id;
  if item.code_hash<>p_hash then return null; end if;
  authorization_id:=cali_session_guard.authorize_code(item.user_id,item.created_at);
  if authorization_id is null then return null; end if;
  update cali_private.workspace_access_codes set used_at=clock_timestamp() where id=item.id;
  select role into profile_role from cali_workspace.profiles where id=item.user_id;
  return jsonb_build_object('email',item.email,'role',profile_role,
    'userId',item.user_id,'authorizationId',authorization_id);
end; $$;
revoke all on function cali_workspace.consume_workspace_code_v2(text,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.consume_workspace_code_v2(text,text) to service_role;
commit;
