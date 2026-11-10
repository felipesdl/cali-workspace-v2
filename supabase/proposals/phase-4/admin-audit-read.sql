-- FLOW-16. Eventos operacionais selecionados, sem metadados livres ou escrita.
begin;
set local lock_timeout='5s';

create or replace function cali_workspace.v2_read_pilot_audit(
  p_company_id uuid,p_month date,p_page integer
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
begin
  if p_page is null or p_page not between 1 and 10000
    or (p_month is not null and (not isfinite(p_month) or extract(day from p_month)<>1)) then
    raise exception using errcode='22023',message='Período ou página inválidos.';
  end if;
  return (
    with filtered as (
      select a.id,a.created_at,a.event_type,a.entity_type,a.entity_id,a.actor_user_id,
        case when jsonb_typeof(a.metadata->'version')='number' then a.metadata->'version' end as revision
      from cali_workspace.activity_log a
      where a.company_id=p_company_id
        and (p_month is null or (
          a.created_at >= (p_month::timestamp at time zone 'America/Sao_Paulo')
          and a.created_at < ((p_month+interval '1 month') at time zone 'America/Sao_Paulo')
        ))
        and a.event_type in (
          'report_draft_created','report_review','report_approve','report_pdf_generated',
          'report_released_in_app','report_reopen','report_release_acknowledged',
          'document_revision_added','document_published','document_withdrawn',
          'deliverable_reopened','deliverable_client_approved',
          'record_open','account_record_feedback','record_reopen_requested','record_reopen_decided',
          'agenda_change_requested','agenda_change_decided','scheduling_event_not_occurred',
          'notice_comment_hidden','notice_comment_restored','capacity_pause_recorded','capacity_pause_resumed',
          'satisfaction_followup_saved',
          'commercial_proposal_created','commercial_proposal_edited','commercial_proposal_approved',
          'commercial_proposal_delivered','commercial_proposal_accepted',
          'form_draft_created','form_draft_edited','form_open','form_closed','form_response_triaged','form_responses_exported'
        )
    ), selected as (
      select * from filtered order by created_at desc,id desc limit 25 offset (p_page-1)*25
    ), page as (
      select f.id::text as id,f.created_at as "at",f.event_type as event,f.entity_type as "entity",
        f.entity_id as "objectId",case when f.actor_user_id is null then 'Sistema'
          else coalesce(nullif(btrim(p.full_name),''),'Usuário sem identificação') end as "actorName",
        f.revision,coalesce(pdf.protocol,r.protocol) as protocol
      from selected f
      left join cali_workspace.profiles p on p.id=f.actor_user_id
      left join cali_workspace.reports r on f.entity_type='report' and r.id=f.entity_id and r.company_id=p_company_id
      left join lateral (
        select a.metadata->>'protocol' as protocol
        from cali_workspace.activity_log a
        where f.entity_type='report' and f.revision is not null and a.company_id=p_company_id
          and a.entity_type='report' and a.entity_id=f.entity_id and a.event_type='report_pdf_generated'
          and a.metadata->'version'=f.revision
          and a.metadata->>'protocol' ~ '^CALI-EXEC-[0-9]{4}-[0-9]{6}$'
        order by a.created_at desc,a.id desc limit 1
      ) pdf on true
    )
    select jsonb_build_object('companyId',p_company_id,'month',p_month,'total',(select count(*) from filtered),
      'entries',coalesce((select jsonb_agg(to_jsonb(page) order by "at" desc,id desc) from page),'[]'::jsonb))
  );
end;
$$;

revoke all on function cali_workspace.v2_read_pilot_audit(uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_read_pilot_audit(uuid,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
