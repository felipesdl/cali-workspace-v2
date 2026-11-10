-- FLOW-09. Materiais da ata no Workspace, sem alterar os anexos legados.
begin;
set local lock_timeout='5s';

create table if not exists cali_session_guard.phase4_agenda_material (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cali_workspace.events(id),
  kind text not null check (kind in ('link','pdf')),
  label text,
  url text,
  content bytea,
  current boolean not null default true,
  saved_at timestamptz not null default clock_timestamp(),
  saved_by uuid not null,
  check (
    (label is null and url is null and content is null)
    or (kind='link' and label is not null and url is not null and content is null)
    or (kind='pdf' and label is not null and url is null and content is not null)
  )
);
create unique index if not exists phase4_agenda_material_current
  on cali_session_guard.phase4_agenda_material(event_id,kind) where current;
alter table cali_session_guard.phase4_agenda_material enable row level security;
revoke all on cali_session_guard.phase4_agenda_material from public,anon,authenticated,service_role;

create or replace function cali_session_guard.phase4_agenda_material_event(p_company_id uuid,p_appointment_id uuid)
returns uuid language sql stable set search_path=''
as $$
  select e.id from cali_workspace.scheduling_requests r
  join cali_workspace.events e on e.id=r.confirmed_event_id and e.company_id=r.company_id
  join cali_workspace.event_outcomes o on o.event_id=e.id and o.company_id=e.company_id
  where r.id=p_appointment_id and r.company_id=p_company_id and r.status='completed'
    and not (r.extra_visit or r.billable_extra or r.urgency_fee_applies or r.online_extra_requested)
    and e.event_type='meeting' and e.visibility='client' and e.cancelled_at is null
    and e.schedule_class='contractual' and e.source_type='scheduling_request' and e.source_entity_id=r.id
    and e.ends_at<=now() and o.outcome='occurred';
$$;
revoke all on function cali_session_guard.phase4_agenda_material_event(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function cali_workspace.v2_read_pilot_agenda_material(
  p_company_id uuid,p_appointment_id uuid,p_pdf_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_team_actor(p_company_id);
  meeting uuid := cali_session_guard.phase4_agenda_material_event(p_company_id,p_appointment_id);
  payload jsonb;
begin
  if meeting is null then raise exception using errcode='42501',message='Materiais da ata indisponíveis.'; end if;
  perform set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
  if p_pdf_id is not null then
    select jsonb_build_object('id',id,'fileName',label,'content',encode(content,'base64'),
      'sha256',encode(sha256(content),'hex')) into payload
    from cali_session_guard.phase4_agenda_material
    where id=p_pdf_id and event_id=meeting and kind='pdf' and current and content is not null;
    if payload is null then raise exception using errcode='42501',message='PDF indisponível.'; end if;
    return payload;
  end if;
  return coalesce((select jsonb_object_agg(kind,jsonb_build_object('id',id,'label',label,'url',url))
    from cali_session_guard.phase4_agenda_material where event_id=meeting and current),'{}'::jsonb);
end;
$$;

create or replace function cali_workspace.v2_save_pilot_agenda_material(
  p_company_id uuid,p_appointment_id uuid,p_request_id uuid,p_kind text,p_expected uuid,
  p_label text,p_value text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  meeting uuid;
  previous uuid;
  attachment uuid;
  bytes bytea;
  link text;
  label text := nullif(btrim(p_label),'');
  signature bytea;
begin
  if p_request_id is null or p_kind is null or p_kind not in ('link','pdf')
    or (label is null)<>(p_value is null) or length(label)>180 or label ~ '[[:cntrl:]]' then
    raise exception using errcode='22023',message='Confira o material da ata.';
  end if;
  if p_kind='link' and label is not null then
    link:=btrim(p_value);
    if length(link)>2000 or link !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:][:cntrl:]]*)?$'
      or position(chr(92) in link)>0 then
      raise exception using errcode='22023',message='Informe um link HTTPS válido.';
    end if;
  elsif p_kind='pdf' and label is not null then
    if lower(right(label,4))<>'.pdf' or label ~ '/' or position(chr(92) in label)>0
      or length(p_value) not between 12 and 2796204 then
      raise exception using errcode='22023',message='Selecione um PDF de até 2 MiB.';
    end if;
    bytes:=decode(p_value,'base64');
    if octet_length(bytes) not between 8 and 2097152 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then
      raise exception using errcode='22023',message='PDF inválido.';
    end if;
  end if;
  signature:=sha256(convert_to(jsonb_build_array('meeting-material',p_appointment_id,p_kind,p_expected,
    label,link,encode(sha256(bytes),'hex'))::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('phase4-agenda:'||p_company_id::text,0));
  attachment:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if attachment is not null then return attachment; end if;
  meeting:=cali_session_guard.phase4_agenda_material_event(p_company_id,p_appointment_id);
  if meeting is null then raise exception using errcode='42501',message='Ata indisponível.'; end if;
  select id into previous from cali_session_guard.phase4_agenda_material
  where event_id=meeting and kind=p_kind and current;
  if previous is distinct from p_expected then
    raise exception using errcode='22023',message='O material mudou. Atualize a agenda.';
  end if;
  update cali_session_guard.phase4_agenda_material set current=false where id=previous;
  insert into cali_session_guard.phase4_agenda_material(event_id,kind,label,url,content,saved_by)
  values(meeting,p_kind,label,link,bytes,actor) returning id into attachment;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,attachment);
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'calendar_minutes_material_changed','event',meeting,
    jsonb_build_object('kind',p_kind,'withdrawn',label is null));
  return attachment;
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_agenda_material(uuid,uuid,uuid),
  cali_workspace.v2_save_pilot_agenda_material(uuid,uuid,uuid,text,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_agenda_material(uuid,uuid,uuid),
  cali_workspace.v2_save_pilot_agenda_material(uuid,uuid,uuid,text,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
