begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_read_subject_history(
  p_company uuid,p_kind text,p_subject uuid,p_page integer
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid:=cali_session_guard.require_pilot_team_actor(p_company);
  admin boolean:=exists(select 1 from cali_workspace.profiles p where p.id=actor and p.role::text='admin');
begin
  if p_page is null or p_page not between 1 and 10000 or p_subject is null
    or p_kind is null or p_kind not in ('record','delivery') then
    raise exception using errcode='22023',message='Recorte inválido.';
  end if;
  if p_kind='record' and not exists(select 1 from cali_workspace.account_records r
    where r.id=p_subject and r.company_id=p_company and (admin or r.visibility='client')) then
    raise exception using errcode='42501',message='Ocorrência indisponível.';
  end if;
  if p_kind='delivery' and not exists(select 1 from cali_workspace.deliverables d
    where d.id=p_subject and d.company_id=p_company and (admin or cali_workspace.client_can_view_deliverable(d.id))) then
    raise exception using errcode='42501',message='Entregável indisponível.';
  end if;

  return (
    with entries as (
      select 'hour:'||h.id as id,'hours'::text as kind,h.work_date::text as at,
        h.description as title,h.minutes
      from cali_workspace.hour_entries h
      where h.company_id=p_company and (admin or (h.client_visible and cali_workspace.hour_project_operational(h.project_id)))
        and case when p_kind='record' then h.account_record_id=p_subject else h.deliverable_id=p_subject end
      union all
      select 'record-decision:'||r.id,'approval',to_jsonb(r.decided_at)#>>'{}',
        case r.status when 'approved' then 'Reabertura aprovada' else 'Reabertura recusada' end,null
      from cali_workspace.account_record_reopen_requests r
      where p_kind='record' and r.company_id=p_company and r.record_id=p_subject
        and r.status in ('approved','rejected') and r.decided_at is not null
      union all
      select 'delivery-approval:'||d.id,'approval',
        to_jsonb(coalesce((select min(c.previous_approved_at) from cali_session_guard.phase4_delivery_corrections c
          where c.company_id=p_company and c.delivery_id=p_subject),case when not exists(select 1 from cali_session_guard.phase4_delivery_corrections c
          where c.company_id=p_company and c.delivery_id=p_subject and c.approved_at is not null) then d.approved_at end))#>>'{}',
        'Entregável aprovado',null
      from cali_workspace.deliverables d
      where p_kind='delivery' and d.id=p_subject and d.company_id=p_company
      union all
      select 'delivery-correction:'||c.id,'approval',to_jsonb(c.approved_at)#>>'{}','Revisão aprovada',null
      from cali_session_guard.phase4_delivery_corrections c
      where p_kind='delivery' and c.company_id=p_company and c.delivery_id=p_subject
    ), visible as (
      select * from entries where at is not null
    ), page as (
      select * from visible order by case when kind='hours' then at::date::timestamp at time zone 'America/Sao_Paulo'
        else at::timestamptz end desc,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('id',p_subject,'total',(select count(*) from visible),
      'entries',coalesce(jsonb_agg(to_jsonb(page) order by case when kind='hours' then at::date::timestamp at time zone 'America/Sao_Paulo'
        else at::timestamptz end desc,id),'[]'::jsonb))
    from page
  );
end;
$$;
revoke all on function cali_workspace.v2_read_subject_history(uuid,text,uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_subject_history(uuid,text,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
