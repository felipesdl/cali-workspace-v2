-- FLOW-18. Aplicar com a versão correspondente de data-lifecycle-export.sql.
-- Contagens para conferência, sem enumerar destinos nem autorizar exclusão.
create or replace function cali_session_guard.phase4_elimination_coverage(
  p_company uuid,p_legacy_paths text[]
)
returns jsonb language sql stable set search_path=''
as $$
  with references_to_check(path) as (
    select d.storage_path from cali_workspace.account_documents d where d.company_id=p_company
    union
    select f.storage_path from cali_workspace.files f where f.company_id=p_company
    union
    select f.cover_storage_path from cali_workspace.files f where f.company_id=p_company
    union
    select a.storage_path from cali_workspace.extra_visit_request_attachments a where a.company_id=p_company
    union
    select substring(c.logo_url from 9) from cali_workspace.companies c
      where c.id=p_company and c.logo_url like 'private:%'
  ), disc_campaigns as (
    select c.id from cali_v2_disc.campaigns c where c.company_id=p_company
  )
  select jsonb_build_object(
    'pathsOutsideLegacy', (select count(*) from references_to_check r where nullif(btrim(r.path),'') is not null
      and not exists(select 1 from unnest(p_legacy_paths) as legacy(path) where legacy.path=r.path)),
    'externalReferences', (
      (select count(*) from cali_workspace.account_documents d
        where d.company_id=p_company and nullif(btrim(d.external_url),'') is not null)
      + (select count(*) from cali_workspace.files f
        where f.company_id=p_company and nullif(btrim(f.drive_url),'') is not null)
      + (select count(*) from cali_workspace.companies c
        where c.id=p_company and nullif(btrim(c.drive_folder_url),'') is not null)
    ),
    'discCampaigns',(select count(*) from disc_campaigns),
    'discResults',(select count(*) from cali_v2_disc.results r join disc_campaigns c on c.id=r.campaign_id),
    'discDispatches',(select count(*) from cali_v2_disc.jobs j join disc_campaigns c on c.id=j.campaign_id)
  );
$$;
revoke all on function cali_session_guard.phase4_elimination_coverage(uuid,text[])
  from public,anon,authenticated,service_role;
