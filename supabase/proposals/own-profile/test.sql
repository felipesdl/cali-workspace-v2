-- Executar somente em PostgreSQL vazio e descartável.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema cali_workspace;
grant usage on schema auth, cali_workspace to authenticated;
create function auth.uid() returns uuid language sql stable
as $$ select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid; $$;
create function cali_workspace.v2_read_terms_state() returns jsonb language sql stable
as $$ select jsonb_build_object('accepted', current_setting('request.jwt.claims', true)::jsonb -> 'accepted'); $$;

create table cali_workspace.profiles (
  id uuid primary key, role text, active boolean, full_name text not null,
  job_title text, email text, phone text, whatsapp text,
  avatar_url text, signature_url text, updated_at timestamptz default now()
);
insert into cali_workspace.profiles (id,role,active,full_name,job_title,email,phone,avatar_url,signature_url) values
 ('10000000-0000-4000-8000-000000000001','admin',true,'Admin sintético','Admin','admin@example.invalid','(00) 0000-0000','foto','assinatura'),
 ('10000000-0000-4000-8000-000000000002','client',true,'Cliente sintético','Analista','cliente@example.invalid',null,'foto cliente','assinatura cliente'),
 ('10000000-0000-4000-8000-000000000003','partner',true,'Partner sintético',null,'partner@example.invalid',null,null,null);

\ir update.sql

set role authenticated;
do $$
declare
  admin_claims jsonb := '{"sub":"10000000-0000-4000-8000-000000000001","accepted":true}';
  before_patch jsonb := '{"job_title":"Admin","phone":"(00) 0000-0000"}';
  result jsonb;
  forbidden jsonb;
begin
  perform set_config('request.jwt.claims',admin_claims::text,true);
  result := cali_workspace.v2_update_own_profile(before_patch,'{"job_title":"Coordenador"}');
  assert result->>'status' = 'saved';
  assert result->'profile'->>'job_title' = 'Coordenador';
  assert result->'profile'->>'phone' = '(00) 0000-0000';
  assert not (result->'profile' ? 'avatar_url');
  assert cali_workspace.v2_update_own_profile(before_patch,'{"job_title":"Coordenador"}')->>'status' = 'saved';
  assert cali_workspace.v2_update_own_profile(before_patch,'{"job_title":"Outro"}')->>'status' = 'conflict';
  assert cali_workspace.v2_update_own_profile(before_patch,'{"phone":null}')->'profile'->'phone' = 'null'::jsonb;
  foreach forbidden in array array['{"email":"novo@example.invalid"}'::jsonb,'{"role":"client"}','{"full_name":null}','{"phone":123}','{"job_title":" "}'] loop
    begin
      perform cali_workspace.v2_update_own_profile(before_patch || forbidden,forbidden);
      raise exception 'Alteração inválida foi aceita';
    exception when invalid_parameter_value then null;
    end;
  end loop;

  perform set_config('request.jwt.claims', (admin_claims || '{"accepted":false}')::text,true);
  begin
    perform cali_workspace.v2_update_own_profile(before_patch,'{"job_title":"Outro"}');
    raise exception 'Sessão sem aceite foi aceita';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","accepted":true}',true);
  assert cali_workspace.v2_update_own_profile('{"whatsapp":null}','{"whatsapp":"(00) 90000-0000"}')->>'status' = 'saved';

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","accepted":true}',true);
  begin
    perform cali_workspace.v2_update_own_profile('{"job_title":null}','{"job_title":"Outro"}');
    raise exception 'Papel fora do escopo foi aceito';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  assert exists (select 1 from cali_workspace.profiles where role='admin'
    and job_title='Coordenador' and phone is null and email='admin@example.invalid'
    and avatar_url='foto' and signature_url='assinatura');
  assert exists (select 1 from cali_workspace.profiles where role='client'
    and job_title='Analista' and whatsapp='(00) 90000-0000'
    and avatar_url='foto cliente' and signature_url='assinatura cliente');
  assert not has_function_privilege('anon','cali_workspace.v2_update_own_profile(jsonb,jsonb)','EXECUTE');
  assert not has_function_privilege('service_role','cali_workspace.v2_update_own_profile(jsonb,jsonb)','EXECUTE');
end;
$$;

\ir rollback.sql
do $$
begin
  assert to_regprocedure('cali_workspace.v2_update_own_profile(jsonb,jsonb)') is null;
  assert (select job_title from cali_workspace.profiles where role='admin') = 'Coordenador';
end;
$$;
select 'Perfil próprio, preservação, conflito, repetição e rollback validados.' as resultado;
