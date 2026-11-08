-- FLOW-15. Preparação de membros sintéticos da equipe CALI, sem convite.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_save_pilot_staff_draft(
  p_company_id uuid,p_request_id uuid,p_member_id uuid,p_expected timestamptz,
  p_name text,p_modules text[],p_remove boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  member_id uuid := coalesce(p_member_id,p_request_id);
  name text := btrim(p_name);
  selected_modules text[];
  signature bytea;
  previous uuid;
  current_revision timestamptz;
begin
  if p_remove is null or (p_member_id is null and (p_remove or p_expected is not null))
    or (p_member_id is not null and p_expected is null) then
    raise exception using errcode='22023',message='Confira a operação de equipe.';
  end if;
  if not p_remove and (
    coalesce(length(name),0) not between 2 and 96 or name ~ '[<>]'
    or coalesce(cardinality(p_modules),0) not between 1 and 9
    or array_position(p_modules,null::text) is not null
    or not (p_modules <@ array['records','projects','hours','calendar','documents','reports','notices','team','people_map'])
  ) then raise exception using errcode='22023',message='Confira o nome e os módulos.'; end if;
  select array_agg(distinct m order by m) into selected_modules from unnest(p_modules) m;
  signature:=sha256(convert_to(jsonb_build_array('staff-draft',p_member_id,p_expected,name,selected_modules,p_remove)::text,'UTF8'));
  previous:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if previous is not null then return previous; end if;

  if p_member_id is null then
    insert into cali_workspace.staff_members(id,email,full_name,active,modules,updated_at)
    values(member_id,'cali-qa-staff-'||member_id::text||'@example.invalid',
      '[TESTE V2] '||name,false,selected_modules,clock_timestamp());
    insert into cali_workspace.staff_company_assignments(staff_id,company_id,assigned_at)
    values(member_id,p_company_id,clock_timestamp());
  else
    select s.updated_at into current_revision from cali_workspace.staff_members s
    join cali_workspace.staff_company_assignments a on a.staff_id=s.id
    where s.id=member_id and a.company_id=p_company_id and not s.active
      and s.user_id is null and s.accepted_at is null and s.invited_by is null
      and s.email='cali-qa-staff-'||s.id::text||'@example.invalid'
      and not exists(select 1 from cali_workspace.staff_company_assignments other
        where other.staff_id=s.id and other.company_id<>p_company_id)
    for update of s,a;
    if not found then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
    if current_revision is distinct from p_expected then
      raise exception using errcode='40001',message='O vínculo mudou. Recarregue a equipe.';
    end if;
    if p_remove then
      delete from cali_workspace.staff_company_assignments where staff_id=member_id and company_id=p_company_id;
    else
      update cali_workspace.staff_members set full_name='[TESTE V2] '||name,modules=selected_modules,
        updated_at=clock_timestamp() where id=member_id;
    end if;
  end if;
  insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_company_id,actor,'staff_draft_saved','staff_member',member_id,
    jsonb_build_object('operation',case when p_remove then 'unassign' when p_member_id is null then 'create' else 'edit' end));
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,member_id);
  return member_id;
end;
$$;
revoke all on function cali_workspace.v2_save_pilot_staff_draft(uuid,uuid,uuid,timestamptz,text,text[],boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_save_pilot_staff_draft(uuid,uuid,uuid,timestamptz,text,text[],boolean)
  to authenticated;
notify pgrst,'reload schema';
commit;
