-- FLOW-10. A conversa preserva a notificação no aplicativo, sem enfileirar e-mail.
begin;
set local lock_timeout = '5s';

create table if not exists cali_session_guard.phase4_record_attachments (
  message_id uuid primary key references cali_workspace.account_record_messages(id) on delete cascade,
  file_name text not null,
  content bytea not null check (octet_length(content) between 8 and 2097152),
  withdrawn_at timestamptz,
  withdrawn_by uuid
);
alter table cali_session_guard.phase4_record_attachments enable row level security;
revoke all on cali_session_guard.phase4_record_attachments from public,anon,authenticated,service_role;


-- O gatilho de menções legado marca e-mail antes do despacho AFTER INSERT.
create function cali_session_guard.phase4_record_mention_in_app()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.notification_type='chat_mention' and new.entity_type='account_record'
    and current_setting('cali_workspace.v2_record_chat',true)=new.company_id::text||':'||new.entity_id::text then
    new.email_required := false;
  end if;
  return new;
end;
$$;
revoke all on function cali_session_guard.phase4_record_mention_in_app() from public,anon,authenticated,service_role;
create trigger zz_phase4_record_mention_in_app before insert on cali_workspace.notifications
for each row execute function cali_session_guard.phase4_record_mention_in_app();

create or replace function cali_workspace.v2_read_pilot_record(p_company_id uuid,p_record_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  admin boolean := exists(select 1 from cali_workspace.profiles where id=actor and role::text='admin');
  attachments_enabled boolean := to_regprocedure(
    'cali_workspace.v2_post_pilot_record_pdf(uuid,uuid,uuid,text,boolean,text,text)'
  ) is not null;
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023', message='Página inválida.';
  end if;
  return (
    select jsonb_build_object('id',r.id,'title',r.title,'status',r.workflow_status,'visibility',r.visibility,
      'attachmentsEnabled',attachments_enabled,
      'imageAttachmentsEnabled',to_regprocedure(
        'cali_workspace.v2_post_pilot_record_image(uuid,uuid,uuid,text,boolean,text,text)') is not null,
      'feedback',(select jsonb_build_object('score',f.score,'comment',f.comment)
        from cali_workspace.account_record_feedback f where f.company_id=p_company_id and f.record_id=r.id and f.user_id=actor),
      'reopen',(select jsonb_build_object('id',q.id,'status',q.status,
        'reason',case when admin or q.requested_by=actor then q.reason end,
        'note',q.decision_note)
        from cali_workspace.account_record_reopen_requests q where q.company_id=p_company_id and q.record_id=r.id
        order by (q.status='pending') desc,q.requested_at desc,q.id desc limit 1),
      'messages',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from (
        select m.id,m.body,m.author_role,m.visibility,m.created_at,
          case when attachments_enabled and a.message_id is not null then
            jsonb_build_object('fileName',a.file_name,'canWithdraw',admin and m.author_role='admin') end as attachment
        from cali_workspace.account_record_messages m
        left join cali_session_guard.phase4_record_attachments a on a.message_id=m.id and a.withdrawn_at is null
        where m.record_id=r.id and m.company_id=p_company_id
          and m.deleted_at is null and (admin or m.visibility='client')
        order by m.created_at desc,m.id desc limit 25 offset (p_page-1)*25
      ) page),'[]'::jsonb))
    from cali_workspace.account_records r where r.id=p_record_id and r.company_id=p_company_id
      and (admin or r.visibility='client')
  );
end;
$$;

create or replace function cali_workspace.v2_pilot_record_action(
  p_company_id uuid,p_request_id uuid,p_record_id uuid,p_action text,
  p_title text default null,p_body text default null,p_internal boolean default false,
  p_expected_status text default null,p_next_status text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  actor_role text := (select role::text from cali_workspace.profiles where id=actor);
  record_row cali_workspace.account_records%rowtype;
  signature bytea;
  result_id uuid;
  internal boolean := coalesce(p_internal,false);
  next_status text;
  previous_chat_context text;
begin
  if p_record_id is null or p_action is null or p_action not in ('open','message','change_status')
    or length(p_title)>180 or length(p_body)>6000 then
    raise exception using errcode='22023', message='Revise os dados da ocorrência.';
  end if;
  if internal and actor_role<>'admin' or p_action='change_status' and actor_role<>'admin' then
    raise exception using errcode='42501', message='Operação indisponível para este perfil.';
  end if;
  signature := sha256(convert_to(jsonb_build_array('records',p_record_id,p_action,p_title,p_body,
    internal,p_expected_status,p_next_status)::text,'UTF8'));
  result_id := cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if result_id is not null then return result_id; end if;
  if p_action='change_status' then
    perform pg_advisory_xact_lock(hashtextextended('phase4-record-review:'||p_record_id::text,0));
  end if;
  if p_action='open' then
    if coalesce(length(btrim(p_title)),0)<2 or coalesce(length(btrim(p_body)),0)<2 then
      raise exception using errcode='22023', message='Informe o assunto e a mensagem inicial.';
    end if;
    insert into cali_workspace.account_records(id,company_id,title,record_type,visibility,source_actor,workflow_status,
      requires_action,created_by,last_activity_at)
    values(p_record_id,p_company_id,btrim(p_title),'request',case when internal then 'internal' else 'client' end,
      actor_role,'open',actor_role='client',actor,now());
  end if;
  select * into record_row from cali_workspace.account_records r
  where r.id=p_record_id and r.company_id=p_company_id and (actor_role='admin' or r.visibility='client')
  for update;
  if not found then raise exception using errcode='42501', message='Ocorrência indisponível.'; end if;
  if p_action='change_status' then
    if p_next_status is null or p_next_status not in ('in_progress','waiting_client','standby','completed','cancelled')
      or record_row.workflow_status is distinct from p_expected_status or p_next_status=record_row.workflow_status
      or (record_row.workflow_status in ('completed','cancelled') and p_next_status<>'in_progress') then
      raise exception using errcode='40001', message='A ocorrência mudou de estado.';
    end if;
    perform cali_workspace.set_account_record_status(p_record_id,p_next_status);
    result_id := p_record_id;
  else
    if nullif(btrim(p_body),'') is null or record_row.workflow_status in ('cancelled','completed')
      or (actor_role='client' and record_row.workflow_status='standby') then
      raise exception using errcode='22023', message='Mensagem indisponível para esta ocorrência.';
    end if;
    previous_chat_context := current_setting('cali_workspace.v2_record_chat',true);
    perform set_config('cali_workspace.v2_record_chat',p_company_id::text||':'||p_record_id::text,true);
    insert into cali_workspace.account_record_messages(record_id,company_id,author_id,author_role,body,visibility)
    values(p_record_id,p_company_id,actor,actor_role,btrim(p_body),
      case when internal or record_row.visibility<>'client' then 'internal' else 'client' end)
    returning id into result_id;
    perform set_config('cali_workspace.v2_record_chat',coalesce(previous_chat_context,''),true);
    if not internal and record_row.visibility='client' then
      next_status := case when p_action='open' then 'open' when actor_role='admin' then 'waiting_client'
        when record_row.workflow_status='waiting_client' then 'in_progress' else coalesce(record_row.workflow_status,'open') end;
      update cali_workspace.account_records set workflow_status=next_status,last_activity_at=now(),
        requires_action=(actor_role='client'),assigned_to=case when actor_role='admin' then actor else assigned_to end
      where id=p_record_id;
      perform cali_workspace.notify_workspace_movement(p_company_id,actor,
        case when actor_role='client' then 'admin' else 'client' end,'record_message',
        'Nova mensagem na ocorrência',record_row.title,'account_record',p_record_id,
        case when actor_role='client' then '/admin/registros' else '/cliente/registros' end||'?record='||p_record_id::text,
        'normal',false);
    end if;
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'record_'||p_action,'account_record',p_record_id,jsonb_build_object('message_id',result_id));
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,result_id);
  return result_id;
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_record(uuid,uuid,integer),
  cali_workspace.v2_pilot_record_action(uuid,uuid,uuid,text,text,text,boolean,text,text)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_record(uuid,uuid,integer),
  cali_workspace.v2_pilot_record_action(uuid,uuid,uuid,text,text,text,boolean,text,text)
  to authenticated;
notify pgrst, 'reload schema';
commit;
