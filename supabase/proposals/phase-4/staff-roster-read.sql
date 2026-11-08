-- FLOW-15. Consulta administrativa dos vínculos da empresa selecionada.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_read_pilot_staff_roster(p_company_id uuid,p_page integer)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;

  return (
    with matched as (
      select s.id,s.full_name as name,s.active,s.modules,
        case when s.invited_by is null and s.user_id is null and s.accepted_at is null
            and s.email='cali-qa-staff-'||s.id::text||'@example.invalid' then 'not_invited'
          when s.accepted_at is not null and s.user_id is not null then 'accepted'
          when s.invited_at is not null then 'invited' else 'not_invited' end as invitation,
        a.assigned_at as "assignedAt",
        case when s.user_id is null and s.accepted_at is null and s.invited_by is null
          and s.email='cali-qa-staff-'||s.id::text||'@example.invalid'
          and not exists(select 1 from cali_workspace.staff_company_assignments other
            where other.staff_id=s.id and other.company_id<>p_company_id)
        then s.updated_at end as "activationRevision",
        case when not s.active and s.user_id is null and s.accepted_at is null and s.invited_by is null
          and s.email='cali-qa-staff-'||s.id::text||'@example.invalid'
          and not exists(select 1 from cali_workspace.staff_company_assignments other
            where other.staff_id=s.id and other.company_id<>p_company_id)
        then s.updated_at end as "draftRevision"
      from cali_workspace.staff_company_assignments a
      join cali_workspace.staff_members s on s.id=a.staff_id
      where a.company_id=p_company_id
    ), selected as (
      select * from matched order by name,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('companyId',p_company_id,'total',(select count(*) from matched),
      'entries',coalesce((select jsonb_agg(to_jsonb(selected) order by name,id) from selected),'[]'::jsonb))
  );
end;
$$;
revoke all on function cali_workspace.v2_read_pilot_staff_roster(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_staff_roster(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
