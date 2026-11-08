create table public.mapa_respostas(id uuid primary key,protocolo text,status text,created_at timestamptz default now(),
  c_email text,observacoes jsonb not null default '{}');
\ir mapa-operations.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  record_id uuid:=gen_random_uuid();
  outside uuid:=gen_random_uuid();
  expired uuid:=gen_random_uuid();
  actor uuid;
  other_admin uuid:=gen_random_uuid();
  result jsonb;
begin
  perform cali_workspace.fixture_as('admin');
  actor:=auth.uid();
  insert into public.mapa_respostas(id,protocolo,status,c_email,observacoes) values
    (record_id,'CALI-QA-V2-MAPA-01','novo','qa@example.invalid','{"d1_obs":"preservar"}'),
    (outside,'MAPA-LEGADO','novo','qa@example.invalid','{}'),
    (expired,'CALI-QA-V2-MAPA-02','novo','qa@example.invalid','{}');
  insert into cali_session_guard.phase4_mapa_scope(record_id,company_id,operator_id,expires_at)
    values(record_id,a,actor,now()+interval '1 day'),(outside,a,actor,now()+interval '1 day'),
      (expired,a,actor,now()-interval '1 day');
  insert into cali_workspace.profiles(id,role,active) values(other_admin,'admin',true);
  set local role authenticated;
  result:=cali_workspace.v2_list_pilot_mapa(a,1);
  assert result->>'total'='1' and result#>>'{entries,0,id}'=record_id::text;
  assert result::text not like '%@example.invalid%';
  assert cali_workspace.v2_list_pilot_mapa(b,1)->>'total'='0';
  assert cali_workspace.v2_review_pilot_mapa(a,record_id,0,'em_andamento','Parecer de teste')=record_id;
  assert cali_workspace.v2_review_pilot_mapa(a,record_id,0,'em_andamento','Parecer de teste')=record_id;
  begin
    perform cali_workspace.v2_review_pilot_mapa(a,record_id,0,'cancelado','Não deve salvar');
    raise exception 'Revisão obsoleta aceita';
  exception when serialization_failure then null; end;
  begin
    perform cali_workspace.v2_review_pilot_mapa(b,record_id,1,'cancelado',null);
    raise exception 'Escrita cruzada aceita';
  exception when insufficient_privilege then null; end;
  perform set_config('test.jwt',jsonb_build_object('sub',other_admin,'aal','aal2')::text,true);
  assert cali_workspace.v2_list_pilot_mapa(a,1)->>'total'='0';
  begin
    perform cali_workspace.v2_review_pilot_mapa(a,record_id,1,'cancelado',null);
    raise exception 'Admin sem inscrição escreveu no Mapa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('clientA');
  begin
    perform cali_workspace.v2_list_pilot_mapa(a,1);
    raise exception 'Cliente leu triagem Mapa';
  exception when insufficient_privilege then null; end;
  perform cali_workspace.fixture_as('admin1');
  begin
    perform cali_workspace.v2_list_pilot_mapa(a,1);
    raise exception 'Admin sem MFA leu triagem Mapa';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select observacoes from public.mapa_respostas where id=record_id)
    ='{"d1_obs":"preservar","parecer":"Parecer de teste"}'::jsonb;
  assert (select count(*) from cali_workspace.activity_log where entity_id=record_id and event_type='mapa_review_saved')=1;
end $$;
rollback;
\ir rollback-mapa-operations.sql
\echo Fase 4E: Mapa com triagem, operador, MFA, escopo e concorrência validados.
