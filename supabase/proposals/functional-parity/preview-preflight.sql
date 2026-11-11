-- Consultar somente o catálogo do projeto isolado. Não lê segredos nem dados de participantes.
begin read only;
with procedures(area,signature,actor) as (
  values
    ('Acesso','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','service_role'),
    ('Admissão','cali_workspace.admit_workspace_session_v2(uuid,uuid)','service_role'),
    ('Termos','cali_workspace.v2_read_terms_state()','authenticated'),
    ('DISC legado','cali_workspace.v2_disc_legacy_public(text,uuid,text,jsonb)','anon'),
    ('Histórico DISC legado','cali_workspace.v2_disc_legacy_admin(uuid)','authenticated'),
    ('PDF DISC legado','cali_workspace.v2_disc_legacy_delivery(text,uuid,jsonb)','service_role'),
    ('DISC novo','cali_workspace.v2_disc_document(uuid,uuid)','authenticated'),
    ('Forms público','public.v2_resolve_public_form(text)','anon'),
    ('Envio Forms','public.v2_submit_resolved_public_form(text,uuid,text,uuid,jsonb)','anon'),
    ('Planilha Forms','cali_workspace.v2_export_pilot_form_responses(uuid,uuid)','authenticated'),
    ('Anexo Forms','cali_workspace.v2_list_pilot_form_attachments(uuid,uuid,uuid)','authenticated'),
    ('Restauração Forms','cali_workspace.v2_restore_form(uuid,uuid)','authenticated'),
    ('Agenda','cali_workspace.v2_list_pilot_appointments(uuid,integer)','authenticated'),
    ('Coordenação Agenda','cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)','service_role'),
    ('Catálogo Drive','cali_workspace.v2_list_drive_sources(integer,uuid)','authenticated'),
    ('Cópia Drive','cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text)','service_role')
), resolved as (
  select area,actor,to_regprocedure(signature) as proc from procedures
), checks as (
  select area,coalesce(has_function_privilege(actor::name,proc,'execute'),false) as ok from resolved
  union all select 'Recibo Drive exclusivo do servidor',coalesce((
    select not has_function_privilege('authenticated',proc,'execute') from resolved where area='Cópia Drive'
  ),false)
  union all select 'DISC sem relatório individual público',coalesce((
    select not has_function_privilege('anon',proc,'execute')
      and not has_function_privilege('authenticated',proc,'execute')
    from (select to_regprocedure('public.cali_profile_report(uuid)') as proc) report
    where proc is not null
  ),true)
  union all select 'DISC sem envio V1 pelo navegador',coalesce((
    select not has_function_privilege('anon',proc,'execute')
      and not has_function_privilege('authenticated',proc,'execute')
    from (select to_regprocedure('public.cali_profile_report_ready(uuid,text)') as proc) report
    where proc is not null
  ),true)
  union all select 'Confirmação Forms sem transporte no escritor legado',coalesce((
    select pg_get_functiondef(proc) not ilike '%net.http_post%'
    from (select to_regprocedure('public.cali_form_submit(text,jsonb)') as proc) writer
    where proc is not null
  ),false)
  union all select 'Gatilho único de confirmação Forms',exists(
    select 1 from pg_trigger where tgrelid=to_regclass('cali_workspace.form_responses')
      and tgname='v2_form_confirmation' and tgenabled in ('O','A')
  )
)
select area,ok from checks order by area;
rollback;
