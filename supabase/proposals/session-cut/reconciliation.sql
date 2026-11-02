-- Candidata complementar de convites/eligibilidade. Não aplicada no hospedado.
-- Pré-requisito: comparação com catálogo ativo e reconciliação da Edge no mesmo corte.
begin;
do $$ begin
 if current_setting('cali.session_cut_review',true) is distinct from 'reviewed-v1'
    or to_regnamespace('cali_session_guard') is null then
   raise exception 'Revisão/candidata base ausente';
 end if;
end $$;
create function cali_session_guard.profile_login_eligible(subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cali_workspace.profiles p
   left join cali_workspace.companies c on c.id=p.company_id
   where p.id=subject and p.active and
     (p.role::text in ('admin','partner') or
       (p.role::text='client' and c.status::text in ('active','paused') and exists(
         select 1 from cali_workspace.client_invites i where i.company_id=p.company_id
           and lower(btrim(i.email))=lower(btrim(p.email)) and i.active and i.platform_access))));
$$;
-- Não concede papel nem dispensa MFA/termos/staff: somente elegibilidade do recorte.
create or replace function cali_session_guard.session_is_live()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
   left join cali_session_guard.profile_cutoffs r on r.user_id=s.user_id
   where s.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
     and (s.not_after is null or s.not_after>statement_timestamp())
     and (r.revoked_before is null or s.created_at>r.revoked_before)
     and cali_session_guard.profile_login_eligible(s.user_id));
$$;
create function cali_workspace.workspace_login_eligible_v2(p_user_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select cali_session_guard.profile_login_eligible(p_user_id);
$$;
create function cali_workspace.workspace_code_eligible_v2(p_user_id uuid,p_created_at timestamptz)
returns boolean language sql security invoker set search_path='' as $$
 select p_created_at is not null and cali_session_guard.profile_login_eligible(p_user_id)
   and not exists(select 1 from cali_session_guard.profile_cutoffs
      where user_id=p_user_id and revoked_before>=p_created_at);
$$;
-- Leitura privada necessária ao wrapper acima é mantida dentro de um definer.
alter function cali_workspace.workspace_code_eligible_v2(uuid,timestamptz) security definer;
revoke all on function cali_session_guard.profile_login_eligible(uuid),
 cali_workspace.workspace_login_eligible_v2(uuid),cali_workspace.workspace_code_eligible_v2(uuid,timestamptz)
 from public,anon,authenticated,service_role;
grant usage on schema cali_session_guard to service_role;
grant execute on function cali_session_guard.profile_login_eligible(uuid),
 cali_workspace.workspace_login_eligible_v2(uuid),cali_workspace.workspace_code_eligible_v2(uuid,timestamptz) to service_role;

create function cali_session_guard.cut_invite_sessions()
returns trigger language plpgsql security definer set search_path='' as $$
declare before_company uuid; after_company uuid; before_email text; after_email text;
begin
 if tg_op='UPDATE' then
   if old.active is not distinct from new.active and old.platform_access is not distinct from new.platform_access
      and old.email is not distinct from new.email and old.company_id is not distinct from new.company_id then
     return new;
   end if;
 end if;
 if tg_op<>'INSERT' then before_company:=old.company_id;before_email:=lower(btrim(old.email)); end if;
 if tg_op<>'DELETE' then after_company:=new.company_id;after_email:=lower(btrim(new.email)); end if;
 insert into cali_session_guard.profile_cutoffs(user_id,revoked_before)
   select p.id,clock_timestamp() from cali_workspace.profiles p where p.role::text='client'
    and ((p.company_id=before_company and lower(btrim(p.email))=before_email)
      or (p.company_id=after_company and lower(btrim(p.email))=after_email))
   on conflict(user_id) do update set revoked_before=greatest(
     cali_session_guard.profile_cutoffs.revoked_before,excluded.revoked_before);
 if tg_op='DELETE' then
   update cali_workspace.profiles set active=false where role::text='client'
     and company_id=before_company and lower(btrim(email))=before_email and active;
   return old;
 end if;
 if not new.active or not new.platform_access then
   update cali_workspace.profiles set active=false where role::text='client'
     and company_id=after_company and lower(btrim(email))=after_email and active;
 end if;
 -- Reativar convite não reativa perfil por efeito implícito; operação Admin é explícita.
 return new;
end; $$;
create trigger v2_invite_session_cut after insert or update or delete on cali_workspace.client_invites
 for each row execute function cali_session_guard.cut_invite_sessions();
revoke all on function cali_session_guard.cut_invite_sessions() from public,anon,authenticated,service_role;
commit;
