-- Consultar somente o catálogo do projeto isolado. Não lê segredos nem dados de participantes.
begin read only;
with procedures(area,signature,actor) as (
  values
    ('Acesso','cali_workspace.v2_preview_access_code(text,text,text,uuid,boolean)','service_role'),
    ('Admissão','cali_workspace.admit_workspace_session_v2(uuid,uuid)','service_role'),
    ('Termos','cali_workspace.v2_read_terms_state()','authenticated'),
    ('Perfil próprio','cali_workspace.v2_update_own_profile(jsonb,jsonb)','authenticated'),
    ('Notificações','cali_workspace.v2_list_my_notifications()','authenticated'),
    ('Equipe','cali_workspace.v2_list_pilot_team(uuid,text,text,integer)','authenticated'),
    ('Dados mensais','cali_workspace.v2_read_pilot_team_month(uuid,date)','authenticated'),
    ('Pré-cadastro','cali_workspace.v2_submit_pre_registration(uuid,text,text,text,text,text,text)','anon'),
    ('Liberação da ficha','cali_workspace.v2_release_pre_registration(uuid,uuid,boolean,jsonb)','authenticated'),
    ('Provisionamento após liberação','cali_workspace.v2_prepare_pilot_invite_login(text)','service_role'),
    ('Responsáveis','cali_workspace.v2_read_company_responsibles(uuid)','authenticated'),
    ('Solicitações de avaliação','cali_workspace.v2_read_satisfaction_requests(uuid,date,integer)','authenticated'),
    ('Tendência de satisfação','cali_workspace.v2_read_pilot_satisfaction_period(uuid,date,integer)','authenticated'),
    ('Reenvio de relatório','cali_workspace.v2_resend_pilot_report(uuid,uuid,integer,uuid)','authenticated'),
    ('Histórico por assunto','cali_workspace.v2_read_subject_history(uuid,text,uuid,integer)','authenticated'),
    ('Cronômetro Partner','cali_workspace.v2_read_partner_pilot_timer(uuid)','authenticated'),
    ('Recuperação do cronômetro','cali_workspace.v2_adjust_partner_pilot_hours(uuid,uuid,uuid,date,integer,text,text)','authenticated'),
    ('Rascunho Partner de relatório','cali_workspace.v2_list_partner_report_drafts(uuid,integer)','authenticated'),
    ('Revisão de relatório Partner','cali_workspace.v2_materialize_partner_report_draft(uuid,uuid,timestamptz)','authenticated'),
    ('Rascunho Partner de proposta','cali_workspace.v2_list_partner_proposal_drafts(uuid,integer)','authenticated'),
    ('Reenvio de proposta','cali_workspace.v2_resend_pilot_commercial_offer(uuid,uuid,timestamptz,uuid)','authenticated'),
    ('Parecer Partner do Mapa','cali_workspace.v2_list_partner_mapa_opinions(integer)','authenticated'),
    ('Revisão de parecer Partner','cali_workspace.v2_list_pilot_mapa_opinion_drafts(uuid,integer)','authenticated'),
    ('Entrega do Mapa','cali_workspace.v2_prepare_pilot_mapa_email(uuid,uuid,jsonb,uuid,jsonb)','authenticated'),
    ('DISC legado','cali_workspace.v2_disc_legacy_public(text,uuid,text,jsonb)','anon'),
    ('Histórico DISC legado','cali_workspace.v2_disc_legacy_admin(uuid)','authenticated'),
    ('PDF DISC legado','cali_workspace.v2_disc_legacy_delivery(text,uuid,jsonb)','service_role'),
    ('DISC novo','cali_workspace.v2_disc_document(uuid,uuid)','authenticated'),
    ('Forms público','public.v2_resolve_public_form(text)','anon'),
    ('Envio Forms','public.v2_submit_resolved_public_form(text,uuid,text,uuid,jsonb)','anon'),
    ('Planilha Forms','cali_workspace.v2_export_pilot_form_responses(uuid,uuid)','authenticated'),
    ('Anexo Forms','cali_workspace.v2_list_pilot_form_attachments(uuid,uuid,uuid)','authenticated'),
    ('Triagem Forms','cali_workspace.v2_list_pilot_form_triage(uuid,uuid,integer)','authenticated'),
    ('Restauração Forms','cali_workspace.v2_restore_form(uuid,uuid)','authenticated'),
    ('Agenda','cali_workspace.v2_list_pilot_appointments(uuid,integer)','authenticated'),
    ('Coordenação Agenda','cali_workspace.v2_agenda_calendar_lease(uuid,text,uuid)','service_role'),
    ('Catálogo Drive','cali_workspace.v2_list_drive_sources(integer,uuid)','authenticated'),
    ('Cópia Drive','cali_workspace.v2_drive_copy(uuid,text,uuid,uuid,text,text,uuid,text)','service_role')
), resolved as (
  select area,actor,to_regprocedure(signature) as proc from procedures
), checks as (
  select area,coalesce(has_function_privilege(actor::name,proc,'execute'),false) as ok from resolved
  union all select 'Partner elegível no helper de login',coalesce(
    pg_get_functiondef(to_regprocedure('cali_session_guard.profile_login_eligible(uuid)')) ilike '%partner%',false)
  union all select 'Admissão revalida elegibilidade',coalesce(
    pg_get_functiondef(to_regprocedure('cali_workspace.admit_workspace_session_v2(uuid,uuid)'))
      ilike '%profile_login_eligible%',false)
  union all select 'Allowlist sintética Partner preparada',to_regclass('cali_session_guard.preview_partner_recipients') is not null
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
