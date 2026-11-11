-- Prova transacional: usa somente convite, timer e horas fictícios. Reverter a transação.
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  actor uuid:=gen_random_uuid();
  member uuid:=gen_random_uuid();
  session_id uuid:=gen_random_uuid();
  invite uuid:=gen_random_uuid();
  address text:='cali-qa-staff-'||member::text||'@example.invalid';
  revision timestamptz:=statement_timestamp();
  claims jsonb:=jsonb_build_object('sub',actor,'role','authenticated','session_id',session_id,'aal','aal1');
  terms record;
  target uuid;
  linked record;
  timer_ref uuid;
  start_request uuid:=gen_random_uuid();
  finish_request uuid:=gen_random_uuid();
  result jsonb;
  submission_id uuid;
  project_id uuid:=gen_random_uuid();
  delivery_id uuid:=gen_random_uuid();
  partner_claims text:=(claims||'{"aal":"aal2"}')::text;
  admin_claims text;
  reject_id uuid;
  admin_id uuid;
  admin_session uuid;
begin
  select version,content_hash into strict terms from cali_v2_terms.publications where is_current;
  insert into auth.users(id,email,email_confirmed_at) values(actor,address,now());
  insert into auth.sessions(id,user_id) values(session_id,actor);
  insert into cali_workspace.staff_members(id,email,full_name,modules,active,updated_at)
    values(member,address,'[TESTE V2] Partner QA',array['projects','records','hours'],true,revision);
  insert into cali_workspace.staff_company_assignments(staff_id,company_id) values(member,a);
  insert into cali_session_guard.phase4_staff_invites(id,company_id,member_id,member_revision,
    target_user_id,issued_by,expires_at) values(invite,a,member,revision,actor,actor,now()+interval '5 minutes');

  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
    values(gen_random_uuid(),actor,'totp','verified',now(),now());
  perform set_config('request.jwt.claims',(claims||'{"aal":"aal2"}')::text,true);
  -- Usa um alvo já inscrito no piloto sintético da fase 4.
  if current_setting('cali.qa.review_admin',true)='on' then
    insert into cali_workspace.projects values(project_id,a,'Projeto sintético','normal');
    insert into cali_session_guard.phase4_project_qa values(project_id,a);
    insert into cali_workspace.deliverables(id,company_id,project_id,title,client_visible,status)
      values(delivery_id,a,project_id,'Entrega de horas',true,'in_progress');
    insert into cali_workspace.deliverable_tasks(id,company_id,deliverable_id,title,status)
      values(gen_random_uuid(),a,delivery_id,'Tarefa de horas','in_progress');
  end if;
  select h.id into target from cali_session_guard.phase5_partner_hour_targets(a) h
    where h.kind='task' order by h.id limit 1;
  set local role authenticated;
  perform cali_workspace.v2_accept_partner_pilot_invite();
  perform cali_workspace.v2_accept_partner_pilot_terms(terms.version,terms.content_hash);
  assert cali_workspace.v2_read_partner_pilot_timer(a)->'active'='null'::jsonb;
  begin
    perform cali_workspace.v2_change_partner_pilot_timer(b,start_request,'start',null,null,null,'Timer fictício');
    raise exception 'Timer aberto em outra empresa';
  exception when insufficient_privilege then null; end;
  begin
    perform cali_workspace.v2_change_partner_pilot_timer(a,start_request,'start',null,'task',gen_random_uuid(),'Timer fictício');
    raise exception 'Subtarefa fora do escopo';
  exception when insufficient_privilege then null; end;
  assert target is not null,'Sem subtarefa sintética operacional';
  result:=cali_workspace.v2_change_partner_pilot_timer(a,start_request,'start',null,'task',target,'Timer fictício');
  timer_ref:=(result->>'id')::uuid;
  assert result->>'status'='active';
  assert cali_workspace.v2_change_partner_pilot_timer(a,start_request,'start',null,'task',target,'Timer fictício')=result;
  begin
    perform cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'start',null,null,null,'Timer duplicado');
    raise exception 'Segundo timer aberto';
  exception when serialization_failure then null; end;
  reset role;
  update cali_workspace.work_timers set started_at=clock_timestamp()-interval '61 seconds' where id=timer_ref;
  set local role authenticated;
  result:=cali_workspace.v2_change_partner_pilot_timer(a,finish_request,'stop',timer_ref,null,null,null);
  assert result->>'status'='stopped' and result->>'minutes'='2';
  assert cali_workspace.v2_change_partner_pilot_timer(a,finish_request,'stop',timer_ref,null,null,null)=result;
  reset role;
  assert not exists(select 1 from cali_workspace.hour_entries h where h.created_by=actor);
  select id into strict submission_id from cali_session_guard.phase5_partner_hours q
    where q.timer_id=timer_ref and q.status='pending' and q.minutes=2;
  set local role authenticated;
  assert cali_workspace.v2_list_partner_pilot_hour_requests(a,false,1)#>>'{rows,0,status}'='pending';
  begin
    perform cali_workspace.v2_decide_partner_pilot_hours(a,submission_id,true,null);
    raise exception 'Partner aprovou o próprio cronômetro';
  exception when insufficient_privilege then null; end;
  reset role;
  if current_setting('cali.qa.review_admin',true)='on' then
    select p.id,s.id into strict admin_id,admin_session from cali_workspace.profiles p
      join auth.sessions s on s.user_id=p.id where p.role='admin';
    admin_claims:=jsonb_build_object('sub',admin_id,'role','authenticated','session_id',admin_session,'aal','aal2')::text;
    perform set_config('request.jwt.claims',admin_claims,true);
    set local role authenticated;
    assert cali_workspace.v2_list_partner_pilot_hour_requests(a,true,1)#>>'{rows,0,status}'='pending';
    assert cali_workspace.v2_decide_partner_pilot_hours(a,submission_id,true,null)=submission_id;
    assert cali_workspace.v2_decide_partner_pilot_hours(a,submission_id,true,null)=submission_id;
    reset role;
    assert (select count(*) from cali_workspace.hour_entries h where h.created_by=actor
      and h.company_id=a and h.task_id=target and not h.client_visible and h.minutes=2)=1;
    perform set_config('request.jwt.claims',partner_claims,true);
  end if;
  set local role authenticated;
  result:=cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'start',null,null,null,'Trecho curto fictício');
  timer_ref:=(result->>'id')::uuid;
  result:=cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'stop',timer_ref,null,null,null);
  assert result->>'status'='discarded' and result->>'minutes'='0';
  reset role;
  assert not exists(select 1 from cali_session_guard.phase5_partner_hours q where q.timer_id=timer_ref);
  if admin_claims is not null then
    set local role authenticated;
    result:=cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'start',null,null,null,'Trecho a recusar');
    timer_ref:=(result->>'id')::uuid;
    reset role;
    update cali_workspace.work_timers set started_at=clock_timestamp()-interval '2 minutes' where id=timer_ref;
    set local role authenticated;
    perform cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'stop',timer_ref,null,null,null);
    reset role;
    select id into strict reject_id from cali_session_guard.phase5_partner_hours q where q.timer_id=timer_ref;
    perform set_config('request.jwt.claims',admin_claims,true);
    set local role authenticated;
    perform cali_workspace.v2_decide_partner_pilot_hours(a,reject_id,false,'Não aprovado');
    reset role;
    assert (select count(*) from cali_workspace.hour_entries h where h.created_by=actor)=1;
    perform set_config('request.jwt.claims',partner_claims,true);
  end if;
  for linked in
    select distinct on (h.kind) h.* from cali_session_guard.phase5_partner_hour_targets(a) h
    where h.kind in ('project','delivery','record') order by h.kind,h.id
  loop
    set local role authenticated;
    result:=cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'start',null,
      linked.kind,linked.id,'Outro vínculo fictício');
    timer_ref:=(result->>'id')::uuid;
    reset role;
    assert exists(select 1 from cali_workspace.work_timers t where t.id=timer_ref
      and row(t.project_id,t.deliverable_id,t.task_id,t.account_record_id) is not distinct from
        row(linked.project_id,linked.delivery_id,linked.task_id,linked.record_id));
    set local role authenticated;
    perform cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'stop',timer_ref,null,null,null);
    reset role;
  end loop;

  if to_regprocedure('cali_workspace.close_stale_timers(interval)') is not null then
    set local role authenticated;
    result:=cali_workspace.v2_change_partner_pilot_timer(a,gen_random_uuid(),'start',null,null,null,'Trecho inativo');
    timer_ref:=(result->>'id')::uuid;
    begin
      perform cali_workspace.partner_stop_timer(timer_ref,null);
      raise exception 'A RPC legada aceitou cronômetro do piloto';
    exception when insufficient_privilege then null; end;
    reset role;
    update cali_workspace.work_timers set started_at=clock_timestamp()-interval '33 minutes',
      last_seen_at=clock_timestamp()-interval '31 minutes' where id=timer_ref;
    assert cali_workspace.close_stale_timers(interval '30 minutes')=1;
    assert cali_workspace.close_stale_timers(interval '30 minutes')=0;
    assert (select count(*) from cali_session_guard.phase5_partner_hours q
      where q.timer_id=timer_ref and q.status='pending' and q.minutes=2)=1;
    assert not exists(select 1 from cali_workspace.hour_entries h
      where h.description='Trecho inativo');
  end if;

  update cali_session_guard.phase4_staff_invites set revoked_at=clock_timestamp(),revoked_by=actor where id=invite;
  set local role authenticated;
  begin
    perform cali_workspace.v2_read_partner_pilot_timer(a);
    raise exception 'Timer lido após corte';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
