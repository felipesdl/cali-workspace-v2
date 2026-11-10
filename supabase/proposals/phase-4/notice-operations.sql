-- FLOW-13. A empresa selecionada recebe o mesmo aviso no mural e na agenda.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_publish_pilot_notice(
  p_company_id uuid,p_notice_id uuid,p_category text,p_title text,p_body text,p_date date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  inserted uuid;
begin
  if p_notice_id is null or p_category is null or p_category not in ('feriado','atendimento','comunicado')
    or coalesce(length(btrim(p_title)),0) not between 1 and 180 or coalesce(length(btrim(p_body)),0) not between 1 and 6000
    or p_date is null or not isfinite(p_date) then
    raise exception using errcode='22023', message='Confira os dados do aviso.';
  end if;
  insert into cali_workspace.notices(id,category,title,body,notice_date,audience,status,created_by,published_at)
  values(p_notice_id,p_category,btrim(p_title),btrim(p_body),p_date,'selected','published',actor,now())
  on conflict(id) do nothing returning id into inserted;
  if inserted is null then
    if exists(select 1 from cali_workspace.notices n join cali_workspace.notice_targets t on t.notice_id=n.id
      where n.id=p_notice_id and n.audience='selected' and n.created_by=actor and t.company_id=p_company_id
        and n.title=btrim(p_title) and n.body=btrim(p_body) and n.category=p_category and n.notice_date=p_date) then
      return p_notice_id;
    end if;
    raise exception using errcode='40001', message='Já existe outro aviso com este identificador.';
  end if;
  insert into cali_workspace.notice_targets(notice_id,company_id) values(p_notice_id,p_company_id);
  perform cali_workspace.notify_workspace_movement(p_company_id,actor,'client','notice','Novo aviso',
    btrim(p_title),'notice',p_notice_id,'/cliente/avisos?aviso='||p_notice_id::text,'normal',false);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'notice_published','notice',p_notice_id,'{}');
  return p_notice_id;
end;
$$;

create function cali_workspace.v2_set_pilot_notice_state(p_company_id uuid,p_notice_id uuid,p_expected text,p_next text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_expected is null or p_next is null or p_expected not in ('published','archived')
    or p_next not in ('published','archived') or p_expected=p_next then
    raise exception using errcode='22023', message='Transição indisponível.';
  end if;
  update cali_workspace.notices n set status=p_next
  where n.id=p_notice_id and n.audience='selected' and n.status=p_expected
    and exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id=p_company_id)
    and not exists(select 1 from cali_workspace.notice_targets t where t.notice_id=n.id and t.company_id<>p_company_id);
  if not found then raise exception using errcode='40001', message='O aviso mudou ou tem outro público.'; end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'notice_'||p_next,'notice',p_notice_id,'{}');
  return p_notice_id;
end;
$$;

create function cali_workspace.v2_ack_pilot_notice(p_company_id uuid,p_notice_id uuid,p_confirm boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'client');
begin
  if p_confirm is null then raise exception using errcode='22023', message='Informe a ação.'; end if;
  perform 1 from cali_workspace.notices n where n.id=p_notice_id and n.status='published'
    and cali_workspace.can_read_notice(n.id) for share;
  if not found then raise exception using errcode='42501', message='Aviso indisponível.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('phase4-notice:'||p_notice_id::text||':'||actor::text,0));
  if p_confirm then
    insert into cali_workspace.notice_acknowledgements(notice_id,user_id,company_id)
    select p_notice_id,actor,p_company_id where not exists(
      select 1 from cali_workspace.notice_acknowledgements a where a.notice_id=p_notice_id and a.user_id=actor
    ) on conflict do nothing;
  else
    delete from cali_workspace.notice_acknowledgements a
    where a.notice_id=p_notice_id and a.user_id=actor and a.company_id=p_company_id;
  end if;
  return p_notice_id;
end;
$$;

revoke all on function cali_workspace.v2_publish_pilot_notice(uuid,uuid,text,text,text,date),
  cali_workspace.v2_set_pilot_notice_state(uuid,uuid,text,text),
  cali_workspace.v2_ack_pilot_notice(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_publish_pilot_notice(uuid,uuid,text,text,text,date),
  cali_workspace.v2_set_pilot_notice_state(uuid,uuid,text,text),
  cali_workspace.v2_ack_pilot_notice(uuid,uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
