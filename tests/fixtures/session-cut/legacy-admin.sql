-- Somente a projeção de tabelas e o transporte de captura para RPCs legadas.
alter table cali_workspace.companies add column service_type text,
  add column monthly_hours_contracted numeric, add column show_hours_to_client boolean;
alter table cali_workspace.client_invites alter column platform_access set default true;
create table cali_workspace.service_cycles (
  company_id uuid, reference_month date, contracted_hours numeric, status text
);
create table cali_workspace.activity_log (
  company_id uuid, actor_user_id uuid, event_type text, entity_type text, entity_id uuid, metadata jsonb
);
create table cali_workspace.profile_links (id uuid primary key, status text, deadline_days integer);
create table cali_workspace.profile_invites (
  id uuid primary key default gen_random_uuid(), link_id uuid, person_name text, email text,
  team_member_id uuid, cycle integer, previous_invite_id uuid, sent_at timestamptz,
  declined_at timestamptz, deadline_at timestamptz
);
create table cali_qa.profile_invite_delivery (payload jsonb);
create function cali_workspace.profile_deadline_from_now(days integer)
returns timestamptz language sql stable as $$ select now() + make_interval(days => days) $$;
create function cali_workspace.profile_post_invite_email(payload jsonb)
returns void language sql as $$ insert into cali_qa.profile_invite_delivery values (payload) $$;
revoke all on function cali_workspace.profile_post_invite_email(jsonb) from public, anon, authenticated;
