-- Fase 5. Consulta paginada dos objetos já inscritos no piloto.
create function cali_workspace.v2_read_partner_pilot_detail(
  p_company uuid,p_module text,p_item uuid,p_page integer
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  access jsonb:=cali_workspace.v2_read_partner_pilot();
  heading text;
begin
  if access->>'status' is distinct from 'ready' or access->>'company' is distinct from p_company::text
    or p_module is null or p_module not in ('projects','records') or not coalesce((access->'modules') ? p_module,false) then
    raise exception using errcode='42501',message='Módulo indisponível.';
  end if;
  if p_page is null or p_page not between 1 and 10000 then
    raise exception using errcode='22023',message='Página inválida.';
  end if;

  if p_module='projects' then
    select p.name into heading from cali_workspace.projects p
    join cali_session_guard.phase4_project_qa q on q.company_id=p.company_id and q.project_id=p.id
    where p.id=p_item and p.company_id=p_company;
  else
    select r.title into heading from cali_workspace.account_records r
    join cali_session_guard.phase4_record_qa q on q.company_id=r.company_id and q.title=r.title
    where r.id=p_item and r.company_id=p_company and r.visibility='client';
  end if;
  if heading is null then return null; end if;

  return (
    with matched as (
      select d.id,d.title as title,d.protocol,d.status::text as status,d.due_at as instant,d.sort_order as ordinal
      from cali_workspace.deliverables d
      where p_module='projects' and d.project_id=p_item and d.company_id=p_company
      union all
      select m.id,m.body,null::text,null::text,m.created_at,null::integer
      from cali_workspace.account_record_messages m
      where p_module='records' and m.record_id=p_item and m.company_id=p_company and m.deleted_at is null
        and m.visibility='client'
    ), page as (
      select * from matched order by ordinal nulls last,instant desc nulls last,id limit 25 offset (p_page-1)*25
    )
    select jsonb_build_object('title',heading,'total',(select count(*) from matched),'rows',
      coalesce((select jsonb_agg(to_jsonb(page)-'ordinal' order by ordinal nulls last,instant desc nulls last,id) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_read_partner_pilot_detail(uuid,text,uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_partner_pilot_detail(uuid,text,uuid,integer) to authenticated;
