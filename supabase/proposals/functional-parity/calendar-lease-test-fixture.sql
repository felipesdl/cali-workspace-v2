create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema cali_workspace;
create schema cali_session_guard;
create table cali_workspace.events(id uuid primary key);
insert into cali_workspace.events(id) values('10000000-0000-4000-8000-000000000005');
grant usage on schema cali_workspace to service_role;
