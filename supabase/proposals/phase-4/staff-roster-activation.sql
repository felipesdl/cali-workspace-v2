-- FLOW-15. Ativação administrativa de rascunho sintético já vinculado ao piloto.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_set_pilot_staff_active(
  p_company_id uuid,p_request_id uuid,p_member_id uuid,p_expected timestamptz,p_active boolean
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  signature bytea;
  previous uuid;
  member cali_workspace.staff_members;
begin
  if p_member_id is null or p_expected is null or p_active is null then
    raise exception using errcode='22023',message='Confira a situação do membro.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('staff-activation',p_member_id,p_expected,p_active)::text,'UTF8'));
  previous:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if previous is not null then return previous; end if;

  select s.* into member from cali_workspace.staff_members s
  join cali_workspace.staff_company_assignments a on a.staff_id=s.id
  where s.id=p_member_id and a.company_id=p_company_id
    and s.email='cali-qa-staff-'||s.id::text||'@example.invalid'
    and s.user_id is null and s.accepted_at is null and s.invited_by is null
    and not exists(select 1 from cali_workspace.staff_company_assignments other
      where other.staff_id=s.id and other.company_id<>p_company_id)
  for update of s,a;
  if not found then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
  if member.updated_at is distinct from p_expected then
    raise exception using errcode='40001',message='A situação mudou. Recarregue a equipe.';
  end if;
  if p_active and coalesce(cardinality(member.modules),0)=0 then
    raise exception using errcode='22023',message='Atribua pelo menos um módulo antes de ativar.';
  end if;
  if member.active is distinct from p_active then
    update cali_workspace.staff_members set active=p_active,updated_at=clock_timestamp()
    where id=member.id;
    insert into cali_workspace.activity_log(company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(p_company_id,actor,'staff_draft_activation_changed','staff_member',member.id,
      jsonb_build_object('active',p_active));
  end if;
  insert into cali_session_guard.phase4_operation_receipts values(actor,p_company_id,p_request_id,signature,member.id);
  return member.id;
end;
$$;
revoke all on function cali_workspace.v2_set_pilot_staff_active(uuid,uuid,uuid,timestamptz,boolean)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_set_pilot_staff_active(uuid,uuid,uuid,timestamptz,boolean)
  to authenticated;
notify pgrst,'reload schema';
commit;
