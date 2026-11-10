-- DISC V2: domínio privado sintético, separado dos tokens e escritores da V1.
begin;
set local lock_timeout='5s';
create schema cali_v2_disc;
revoke all on schema cali_v2_disc from public,anon,authenticated,service_role;
create table cali_v2_disc.campaigns(
 id uuid primary key default gen_random_uuid(),company_id uuid references cali_workspace.companies(id),
 title text not null,organization text not null,purpose text not null,status text not null default 'open' check(status in('open','closed')),
 revision integer not null default 1,goal text not null default '',note text not null default '',moment text not null default '',sector text not null default '',
 focal_name text not null,focal_email text not null,approved_at timestamptz,released_at timestamptz,protocol text,signer jsonb,
 created_at timestamptz not null default clock_timestamp(),created_by uuid not null references auth.users(id)
);
create table cali_v2_disc.config(
 id boolean primary key default true check(id),enabled boolean not null default false,
 hook_secret text not null default encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex')
);
insert into cali_v2_disc.config(id) values(true);
create table cali_v2_disc.allowed_recipients(email text primary key check(email=lower(btrim(email))));
create table cali_v2_disc.invites(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references cali_v2_disc.campaigns(id),
 person_name text not null,email text not null,token uuid not null unique default gen_random_uuid(),
 queued_at timestamptz,sent_at timestamptz,deadline_at timestamptz,opened_at timestamptz,started_at timestamptz,
 last_block integer not null default 0 check(last_block between 0 and 24),declined_at timestamptz,completed_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),unique(campaign_id,email)
);
create table cali_v2_disc.results(
 id uuid primary key default gen_random_uuid(),invite_id uuid not null unique references cali_v2_disc.invites(id),
 campaign_id uuid not null references cali_v2_disc.campaigns(id),person_name text not null,email text not null,job_title text,
 answers jsonb not null,scores jsonb not null,primary_style text not null,secondary_style text not null,mixed boolean not null,
 method_version text not null default 'cali-disc-v1.1',protocol text not null,consent_at timestamptz not null default clock_timestamp(),
 request_id uuid not null,fingerprint text not null,created_at timestamptz not null default clock_timestamp()
);
create sequence cali_v2_disc.protocol_sequence;
create table cali_v2_disc.events(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references cali_v2_disc.campaigns(id),
 kind text not null,revision integer not null,actor_id uuid,reason text,before_state jsonb,after_state jsonb,
 request_id uuid not null unique,fingerprint text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create table cali_v2_disc.jobs(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references cali_v2_disc.campaigns(id),
 invite_id uuid references cali_v2_disc.invites(id),kind text not null,recipient text not null,payload jsonb not null default '{}',
 job_key text not null unique,state text not null default 'pending' check(state in('pending','processing','sent','failed')),
 created_at timestamptz not null default clock_timestamp(),lease_at timestamptz,first_attempt_at timestamptz,finished_at timestamptz,provider_id text,error text,attempts integer not null default 0
);
create table cali_v2_disc.revisions(
 campaign_id uuid not null references cali_v2_disc.campaigns(id),revision integer not null,report jsonb not null,
 approved_at timestamptz not null,primary key(campaign_id,revision)
);
do $$ declare relation text; begin
 foreach relation in array array['config','campaigns','allowed_recipients','invites','results','events','jobs','revisions'] loop
  execute format('alter table cali_v2_disc.%I enable row level security',relation);
  execute format('revoke all on cali_v2_disc.%I from public,anon,authenticated,service_role',relation);
 end loop;
end $$;
create function cali_v2_disc.require_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=cali_session_guard.require_pilot_admin_session();
 if not exists(select 1 from cali_workspace.profiles where id=actor and active and role::text='admin')
  or (cali_workspace.v2_read_terms_state()->>'accepted')::boolean is distinct from true then
  raise exception using errcode='42501',message='DISC indisponível para este acesso.';
 end if;
 return actor;
end $$;
create function cali_v2_disc.protocol(p_type text) returns text language sql volatile security definer set search_path='' as $$
 select 'CALI-'||p_type||'-'||to_char(statement_timestamp() at time zone 'America/Sao_Paulo','YYYY')||'-'||lpad(nextval('cali_v2_disc.protocol_sequence')::text,6,'0');
$$;
create function cali_v2_disc.invite_state(i cali_v2_disc.invites) returns text language sql stable set search_path='' as $$
 select case when i.completed_at is not null then 'completed' when i.declined_at is not null then 'declined'
 when i.deadline_at<statement_timestamp() then 'expired' when i.started_at is not null then 'started' when i.opened_at is not null then 'opened'
 when i.sent_at is not null then 'sent' when i.queued_at is not null then 'queued' else 'created' end;
$$;
create function cali_v2_disc.kick() returns void language plpgsql security definer set search_path='' as $$
declare config cali_v2_disc.config;
begin
 select * into config from cali_v2_disc.config where id;
 if not config.enabled then return;end if;
 execute 'select net.http_post(url:=$1,headers:=$2,body:=$3,timeout_milliseconds:=5000)'
 using 'https://kqtbfeeqbcllwvlkbrkq.supabase.co/functions/v1/workspace-disc-pilot',
 jsonb_build_object('Content-Type','application/json','x-cali-disc-hook',config.hook_secret),'{}'::jsonb;
end $$;
create function cali_v2_disc.queue(p_campaign uuid,p_invite uuid,p_kind text,p_recipient text,p_key text,p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if not exists(select 1 from cali_v2_disc.allowed_recipients where email=lower(btrim(p_recipient))) then
  raise exception using errcode='22023',message='Destinatário fora da homologação autorizada.';
 end if;
 insert into cali_v2_disc.jobs(campaign_id,invite_id,kind,recipient,job_key,payload)
 values(p_campaign,p_invite,p_kind,lower(btrim(p_recipient)),p_key,p_payload) on conflict(job_key) do nothing;
 get diagnostics affected=row_count;
 if affected>0 then perform cali_v2_disc.kick();end if;
end $$;
create function cali_v2_disc.management(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c cali_v2_disc.campaigns; amount integer; distribution jsonb; dominant text; stable_count integer; quantitative jsonb;
begin
 select * into c from cali_v2_disc.campaigns where id=p_id;
 select count(distinct email) into amount from cali_v2_disc.results where campaign_id=p_id;
 if amount>=5 then
  with styles(style) as(values('D'),('I'),('S'),('C'))
  select jsonb_object_agg(style,(select count(*) from cali_v2_disc.results where campaign_id=p_id and primary_style=style)) into distribution from styles;
  select st into dominant from unnest(array['D','I','S','C']) with ordinality as styles(st,ord)
   order by (distribution->>st)::integer desc,(select count(*) from cali_v2_disc.results where campaign_id=p_id and secondary_style=st) desc,ord limit 1;
  select count(*) into stable_count from cali_v2_disc.results r where r.campaign_id=p_id
   and not exists(select 1 from jsonb_each_text(r.scores->'adaptation') where abs(value::integer)>=25);
 end if;
 if amount>=15 then
  with styles(s) as(values('D'),('I'),('S'),('C')),
  changes as(select r.id,count(*) filter(where abs((r.scores->'adaptation'->>st.s)::integer)>=25) as changed
    from cali_v2_disc.results r cross join styles st where r.campaign_id=p_id group by r.id)
  select jsonb_build_object(
   'secondary',(select jsonb_object_agg(st.s,(select count(*) from cali_v2_disc.results where campaign_id=p_id and secondary_style=st.s)) from styles st),
   'mixed',(select count(*) from cali_v2_disc.results where campaign_id=p_id and mixed),
   'bands',(select jsonb_object_agg(st.s,jsonb_build_object(
    'low',(select count(*) from cali_v2_disc.results where campaign_id=p_id and (scores->'natural'->st.s->>'pct')::integer<40),
    'mid',(select count(*) from cali_v2_disc.results where campaign_id=p_id and (scores->'natural'->st.s->>'pct')::integer between 40 and 59),
    'high',(select count(*) from cali_v2_disc.results where campaign_id=p_id and (scores->'natural'->st.s->>'pct')::integer>=60))) from styles st),
   'pressure',jsonb_build_object('stable',(select count(*) from changes where changed=0),'one',(select count(*) from changes where changed=1),'many',(select count(*) from changes where changed>=2),
    'up',(select jsonb_object_agg(st.s,(select count(*) from cali_v2_disc.results where campaign_id=p_id and (scores->'adaptation'->>st.s)::integer>=25)) from styles st),
    'down',(select jsonb_object_agg(st.s,(select count(*) from cali_v2_disc.results where campaign_id=p_id and (scores->'adaptation'->>st.s)::integer<=-25)) from styles st))) into quantitative;
 end if;
 return jsonb_build_object('id',c.id,'title',c.title,'organization',c.organization,'goal',c.goal,'note',c.note,'moment',c.moment,'sector',c.sector,
 'mode',case when amount<5 then 'unavailable' when amount<15 then 'qualitative' else 'quantitative' end,
 'quantitative',quantitative,'sample_size',case when amount>=15 then amount else null end,'distribution',case when amount>=15 then distribution else null end,
 'qualitative',jsonb_build_object('dominant',case when amount<5 then 'Aguardando respostas elegíveis.' else case dominant when 'D' then 'Predomina uma atuação direta, voltada a decisões e resultados.' when 'I' then 'Predomina uma atuação comunicativa, voltada a conexões e mobilização.' when 'S' then 'Predomina uma atuação constante, voltada a apoio e continuidade.' else 'Predomina uma atuação criteriosa, voltada a qualidade e precisão.' end end,
 'pressure',case when amount<5 then 'Aguardando respostas elegíveis.' when (amount-stable_count)::numeric/amount>=0.3 then 'Amplitude alta com cobrança alta é risco de ruptura. Antes de apertar a cobrança, olhe meta, prazo e forma de cobrar.' else 'O time tende a manter o jeito de agir sob pressão: a cobrança pode subir sem mudar o comportamento, mas o desgaste acumula em silêncio.' end),
 'approved_at',c.approved_at,'released_at',c.released_at,'protocol',c.protocol,'signer',c.signer,'revision',c.revision);
end $$;
create function cali_workspace.v2_disc_admin(p_campaign uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=cali_v2_disc.require_admin(); selected jsonb;
begin
 if p_campaign is not null then
  if not exists(select 1 from cali_v2_disc.campaigns where id=p_campaign) then raise exception using errcode='22023',message='Campanha indisponível.'; end if;
  select jsonb_build_object('campaign',to_jsonb(c),
   'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'person_name',i.person_name,'email',i.email,'token',i.token,
     'state',cali_v2_disc.invite_state(i),'deadline_at',i.deadline_at,'last_block',i.last_block) order by i.created_at)
     from cali_v2_disc.invites i where i.campaign_id=c.id),'[]'),
   'evaluations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'person_name',r.person_name,'email',r.email,'job_title',r.job_title,
     'primary_style',r.primary_style,'secondary_style',r.secondary_style,'mixed',r.mixed,'scores',r.scores,'protocol',r.protocol,'created_at',r.created_at)) from cali_v2_disc.results r where r.campaign_id=c.id),'[]'),
   'management',cali_v2_disc.management(c.id),
   'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'state',j.state,'campaign_id',j.campaign_id,'created_at',j.created_at,'error',j.error) order by j.created_at desc)
    from cali_v2_disc.jobs j where j.campaign_id=c.id),'[]'),
   'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'revision',e.revision,'created_at',e.created_at,'reason',e.reason) order by e.created_at desc)
    from cali_v2_disc.events e where e.campaign_id=c.id),'[]')) into selected from cali_v2_disc.campaigns c where c.id=p_campaign;
 end if;
 return jsonb_build_object('campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from cali_v2_disc.campaigns c),'[]'),'selected',selected);
end $$;
create function cali_workspace.v2_disc_client() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare company uuid;
begin
 select p.company_id into company from cali_workspace.profiles p where p.id=auth.uid() and p.active and p.role::text='client';
 perform cali_session_guard.require_pilot_team_actor(company);
 return jsonb_build_object('reports',coalesce((select jsonb_agg(r.report||jsonb_build_object('released_at',c.released_at))
  from cali_v2_disc.campaigns c join cali_v2_disc.revisions r on r.campaign_id=c.id and r.revision=c.revision
  where c.company_id=company and c.released_at is not null and c.approved_at is not null),'[]'));
end $$;
create function cali_workspace.v2_disc_command(p_campaign uuid,p_expected integer,p_request uuid,p_kind text,p_fields jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cali_v2_disc.require_admin();c cali_v2_disc.campaigns; original jsonb; prior cali_v2_disc.events;
 digest text:=encode(sha256(convert_to(jsonb_build_array(p_campaign,p_expected,p_kind,p_fields)::text,'UTF8')),'hex');
 result jsonb; invite cali_v2_disc.invites; recipient record; company uuid; approved jsonb; allowed text[];
begin
 if p_request is null or p_fields is null or jsonb_typeof(p_fields)<>'object' then raise exception using errcode='22023',message='Operação incompleta.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_campaign::text,actor::text),314));
 select * into prior from cali_v2_disc.events where request_id=p_request;
 if prior.id is not null then
  if prior.actor_id<>actor or prior.fingerprint<>digest then raise exception using errcode='22023',message='Identidade de operação já utilizada.';end if;
  return prior.result;
 end if;
 allowed:=case p_kind when 'create' then array['title','companyId','organization','purpose','focalName','focalEmail','goal'] when 'invite' then array['name','email']
 when 'queue' then array['inviteId'] when 'edit' then array['goal','note','moment','sector'] when 'manager_pdf' then array['name','email'] else array['reason'] end;
 if exists(select 1 from jsonb_object_keys(p_fields) k where k<>all(allowed)) then raise exception using errcode='22023',message='Campos fora desta operação.';end if;
 if p_kind='create' then
  if p_campaign is not null or p_expected is not null then raise exception using errcode='22023',message='Nova campanha não recebe versão anterior.';end if;
  company:=nullif(p_fields->>'companyId','')::uuid;
  if company is not null and not exists(select 1 from cali_session_guard.pilot_companies where company_id=company) then raise exception using errcode='42501',message='Empresa fora do piloto.';end if;
  if length(btrim(coalesce(p_fields->>'title',''))) not between 3 and 180 or length(btrim(coalesce(p_fields->>'organization',''))) not between 2 and 180
   or length(btrim(coalesce(p_fields->>'focalName',''))) not between 2 and 120 or length(coalesce(p_fields->>'purpose','')) not between 1 and 120
   or not exists(select 1 from cali_v2_disc.allowed_recipients where email=lower(btrim(p_fields->>'focalEmail')))
   or length(coalesce(p_fields->>'goal',''))>2000 then raise exception using errcode='22023',message='Confira campanha, empresa e contato de homologação.';end if;
  insert into cali_v2_disc.campaigns(company_id,title,organization,purpose,focal_name,focal_email,goal,created_by)
   values(company,btrim(p_fields->>'title'),btrim(p_fields->>'organization'),btrim(p_fields->>'purpose'),btrim(p_fields->>'focalName'),lower(btrim(p_fields->>'focalEmail')),coalesce(p_fields->>'goal',''),actor) returning * into c;
 else
  select * into c from cali_v2_disc.campaigns where id=p_campaign for update;
  if c.id is null then raise exception using errcode='22023',message='Campanha indisponível.';end if;
  if p_expected is distinct from c.revision then raise exception using errcode='40001',message='Campanha alterada. Recarregue antes de continuar.';end if;
  original:=to_jsonb(c);
  if p_kind='invite' then
   if c.status<>'open' or length(btrim(coalesce(p_fields->>'name',''))) not between 2 and 120
    or not exists(select 1 from cali_v2_disc.allowed_recipients where email=lower(btrim(p_fields->>'email'))) then
    raise exception using errcode='22023',message='Confira o destinatário de teste e a campanha.';end if;
   insert into cali_v2_disc.invites(campaign_id,person_name,email) values(c.id,btrim(p_fields->>'name'),lower(btrim(p_fields->>'email')));
  elsif p_kind='queue' then
   select * into invite from cali_v2_disc.invites where id=(p_fields->>'inviteId')::uuid and campaign_id=c.id for update;
   if c.status<>'open' or invite.id is null or invite.sent_at is not null or invite.declined_at is not null then
    raise exception using errcode='22023',message='Convite indisponível para envio.';end if;
   update cali_v2_disc.invites set queued_at=coalesce(queued_at,clock_timestamp()) where id=invite.id;
   perform cali_v2_disc.queue(c.id,invite.id,'invite',invite.email,'invite:'||invite.id);
  elsif p_kind='edit' then
   if exists(select 1 from jsonb_each_text(p_fields) x where length(coalesce(x.value,''))>10000) then raise exception using errcode='22023',message='Texto excede o limite.';end if;
   update cali_v2_disc.campaigns set goal=coalesce(p_fields->>'goal',goal),note=coalesce(p_fields->>'note',note),moment=coalesce(p_fields->>'moment',moment),sector=coalesce(p_fields->>'sector',sector),approved_at=null,released_at=null,signer=null,protocol=null where id=c.id;
  elsif p_kind='approve' then
   if (select count(distinct email) from cali_v2_disc.results where campaign_id=c.id)<5 or length(btrim(c.goal))<3 or length(btrim(c.note))<20 then
    raise exception using errcode='22023',message='Aprovação exige cinco respostas, objetivo e parecer de pelo menos vinte caracteres.';end if;
   approved:=cali_workspace.profile_signer_snapshot();
   if nullif(approved->>'full_name','') is null or nullif(approved->>'avatar_url','') is null then raise exception using errcode='22023',message='Confira a assinatura e foto configuradas da CALI.';end if;
   if c.approved_at is not null then raise exception using errcode='22023',message='Esta revisão já foi aprovada.';end if;
   update cali_v2_disc.campaigns set approved_at=clock_timestamp(),released_at=null,protocol=cali_v2_disc.protocol('GESTAO'),signer=approved where id=c.id;
  elsif p_kind='release' then
   if c.approved_at is null or c.company_id is null then raise exception using errcode='22023',message='Liberação exige revisão aprovada e empresa com conta.';end if;
   update cali_v2_disc.campaigns set released_at=clock_timestamp() where id=c.id;
  elsif p_kind='reopen' then
   if length(btrim(coalesce(p_fields->>'reason','')))<3 then raise exception using errcode='22023',message='Informe o motivo da reabertura.';end if;
   update cali_v2_disc.campaigns set approved_at=null,released_at=null,protocol=null,signer=null where id=c.id;
  elsif p_kind='close' then
   update cali_v2_disc.campaigns set status='closed' where id=c.id;
  elsif p_kind='manager_pdf' then
   if c.approved_at is null or c.company_id is not null then raise exception using errcode='22023',message='PDF ao gestor exige aprovação de campanha sem conta.';end if;
  elsif p_kind='schedule' then null;
  else raise exception using errcode='22023',message='Operação DISC desconhecida.';
  end if;
  update cali_v2_disc.campaigns set revision=revision+1 where id=c.id returning * into c;
 end if;
 if p_kind in('approve','release','queue','invite','schedule','manager_pdf','close') and c.approved_at is not null then
  -- Cada revisão aprovada congela sua projeção; ações operacionais preservam o conteúdo.
  insert into cali_v2_disc.revisions(campaign_id,revision,report,approved_at) values(c.id,c.revision,cali_v2_disc.management(c.id),c.approved_at);
 end if;
 if p_kind='release' then
  for recipient in select distinct lower(p.email) email from cali_workspace.profiles p where p.company_id=c.company_id and p.active and p.role::text='client' loop
   perform cali_v2_disc.queue(c.id,null,'gestao_released',recipient.email,'released:'||c.id||':'||c.revision||':'||recipient.email,jsonb_build_object('report',cali_v2_disc.management(c.id)));
  end loop;
 elsif p_kind='manager_pdf' then
  perform cali_v2_disc.queue(c.id,null,'gestao_pdf',p_fields->>'email','manager:'||c.id||':'||c.revision||':'||lower(p_fields->>'email'),jsonb_build_object('report',cali_v2_disc.management(c.id),'name',p_fields->>'name'));
 end if;
 result:=jsonb_build_object('id',c.id,'revision',c.revision);
 insert into cali_v2_disc.events(campaign_id,kind,revision,actor_id,reason,before_state,after_state,request_id,fingerprint,result)
 values(c.id,p_kind,c.revision,actor,p_fields->>'reason',original,to_jsonb(c),p_request,digest,result);
 return result;
exception when unique_violation then raise exception using errcode='22023',message='Convite ou operação já cadastrado.';
end $$;
create function cali_workspace.v2_disc_public(p_token uuid,p_kind text,p_fields jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare i cali_v2_disc.invites;c cali_v2_disc.campaigns;r cali_v2_disc.results;
 v_natural jsonb;pressure jsonb;nat jsonb;pre jsonb;n6 jsonb;adapt jsonb:='{}';style text;primary_style text;secondary_style text;
 digest text;request uuid;blocks constant integer[]:=array[2,5,8,11,14,17];
begin
 select * into i from cali_v2_disc.invites where token=p_token;
 if i.id is null then return jsonb_build_object('state','invalid','title','','organization','','person_name','','deadline_at',null,'last_block',0);end if;
 perform pg_advisory_xact_lock(hashtextextended(i.campaign_id::text,314));
 select * into c from cali_v2_disc.campaigns where id=i.campaign_id for update;
 select * into i from cali_v2_disc.invites where id=i.id for update;
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or pg_column_size(p_fields)>32768 then raise exception using errcode='22023',message='Pedido inválido.';end if;
 if p_kind not in('read','open','progress','decline','submit') then raise exception using errcode='22023',message='Operação indisponível.';end if;
 if p_kind='submit' and i.completed_at is not null then
  select * into r from cali_v2_disc.results where invite_id=i.id;
  digest:=encode(sha256(convert_to((p_fields-'requestId')::text,'UTF8')),'hex');
  if r.request_id is distinct from (p_fields->>'requestId')::uuid or r.fingerprint<>digest then
   raise exception using errcode='22023',message='Este convite já foi concluído.';end if;
 elsif p_kind<>'read' then
  if c.status<>'open' or i.sent_at is null or i.completed_at is not null or i.declined_at is not null or i.deadline_at<statement_timestamp() then
   raise exception using errcode='22023',message='Convite encerrado ou indisponível.';end if;
  if p_kind='open' then update cali_v2_disc.invites set opened_at=coalesce(opened_at,clock_timestamp()) where id=i.id;
  elsif p_kind='decline' then update cali_v2_disc.invites set declined_at=clock_timestamp() where id=i.id;
  elsif p_kind='progress' then
   if (p_fields->>'block')::integer not between 1 and 24 then raise exception using errcode='22023',message='Bloco inválido.';end if;
   update cali_v2_disc.invites set started_at=coalesce(started_at,clock_timestamp()),last_block=greatest(last_block,(p_fields->>'block')::integer) where id=i.id;
  elsif p_kind='submit' then
   if (p_fields->>'consent')::boolean is distinct from true or length(coalesce(p_fields->>'jobTitle',''))>120
    or exists(select 1 from jsonb_object_keys(p_fields) k where k not in('jobTitle','answers','consent','requestId')) then
    raise exception using errcode='22023',message='Confira o consentimento e os dados da resposta.';end if;
   request:=(p_fields->>'requestId')::uuid;
   if request is null then raise exception using errcode='22023',message='Identidade da resposta ausente.';end if;
   v_natural:=p_fields->'answers'->'natural';pressure:=p_fields->'answers'->'pressure';
   if jsonb_typeof(v_natural) is distinct from 'array' or jsonb_typeof(pressure) is distinct from 'array'
    or jsonb_array_length(v_natural)<>18 or jsonb_array_length(pressure)<>6 then raise exception using errcode='22023',message='Responda todos os blocos.';end if;
   if (select count(distinct (a->>'b')::integer) from jsonb_array_elements(v_natural) a where (a->>'b')~'^\d+$' and (a->>'b')::integer between 1 and 18
    and a->>'mais' in('D','I','S','C') and a->>'menos' in('D','I','S','C') and a->>'mais'<>a->>'menos')<>18
    or (select count(distinct (a->>'b')::integer) from jsonb_array_elements(pressure) a where (a->>'b')~'^\d+$' and (a->>'b')::integer=any(blocks)
    and a->>'mais' in('D','I','S','C') and a->>'menos' in('D','I','S','C') and a->>'mais'<>a->>'menos')<>6 then raise exception using errcode='22023',message='Respostas incompletas ou inválidas.';end if;
   nat:=cali_workspace.profile_tally(v_natural,18);pre:=cali_workspace.profile_tally(pressure,6);
   n6:=cali_workspace.profile_tally((select jsonb_agg(a) from jsonb_array_elements(v_natural) a where (a->>'b')::integer=any(blocks)),6);
   foreach style in array array['D','I','S','C'] loop adapt:=adapt||jsonb_build_object(style,(pre->style->>'pct')::integer-(n6->style->>'pct')::integer);end loop;
   select s into primary_style from unnest(array['D','I','S','C']) with ordinality t(s,o) order by (nat->s->>'pct')::integer desc,o limit 1;
   select s into secondary_style from unnest(array['D','I','S','C']) with ordinality t(s,o) where s<>primary_style order by (nat->s->>'pct')::integer desc,o limit 1;
   digest:=encode(sha256(convert_to((p_fields-'requestId')::text,'UTF8')),'hex');
   insert into cali_v2_disc.results(invite_id,campaign_id,person_name,email,job_title,answers,scores,primary_style,secondary_style,mixed,protocol,request_id,fingerprint)
    values(i.id,c.id,i.person_name,i.email,nullif(btrim(p_fields->>'jobTitle'),''),jsonb_build_object('natural',v_natural,'pressure',pressure),
    jsonb_build_object('natural',nat,'pressure',pre,'natural6',n6,'adaptation',adapt),primary_style,secondary_style,
    (nat->primary_style->>'pct')::integer-(nat->secondary_style->>'pct')::integer<10,cali_v2_disc.protocol('PERFIL'),request,digest);
   update cali_v2_disc.invites set completed_at=clock_timestamp(),last_block=24 where id=i.id;
   -- Resposta nova altera a base aprovada: retira aprovação/liberação; revisão anterior permanece.
   update cali_v2_disc.campaigns set revision=revision+1,approved_at=null,released_at=null,signer=null,protocol=null where id=c.id returning * into c;
   insert into cali_v2_disc.events(campaign_id,kind,revision,request_id,fingerprint,result)
    values(c.id,'response',c.revision,request,digest,jsonb_build_object('state','completed'));
   perform cali_v2_disc.queue(c.id,i.id,'respondent_pdf',i.email,'respondent:'||i.id);
  end if;
 end if;
 select * into i from cali_v2_disc.invites where id=i.id;
 return jsonb_build_object('state',case when c.status<>'open' and i.completed_at is null and i.declined_at is null then 'expired' else cali_v2_disc.invite_state(i) end,
 'title',c.title,'organization',c.organization,'person_name',i.person_name,'deadline_at',i.deadline_at,'last_block',i.last_block);
end $$;
create function cali_workspace.v2_disc_document(p_campaign uuid default null,p_result uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c cali_v2_disc.campaigns;r cali_v2_disc.results;company uuid;report jsonb;
begin
 if p_result is not null then
  perform cali_v2_disc.require_admin();select * into r from cali_v2_disc.results where id=p_result;
  if r.id is null then raise exception using errcode='42501',message='Relatório indisponível.';end if;
  select * into c from cali_v2_disc.campaigns where id=r.campaign_id;
  return jsonb_build_object('audience','evaluator','title',c.title,'organization',c.organization,'protocol',r.protocol,'personName',r.person_name,
   'primary',r.primary_style,'secondary',r.secondary_style,'mixed',r.mixed,'scores',r.scores,'createdAt',r.created_at,'signer',cali_workspace.profile_signer_snapshot());
 end if;
 if exists(select 1 from cali_workspace.profiles where id=auth.uid() and active and role::text='admin') then
  perform cali_v2_disc.require_admin();
 else
  select p.company_id into company from cali_workspace.profiles p where p.id=auth.uid() and p.active and p.role::text='client';
  perform cali_session_guard.require_pilot_team_actor(company);
 end if;
 select * into c from cali_v2_disc.campaigns where id=p_campaign;
 if c.id is null or c.approved_at is null or (company is not null and (c.company_id is distinct from company or c.released_at is null)) then
  raise exception using errcode='42501',message='Relatório indisponível.';end if;
 select frozen.report into report from cali_v2_disc.revisions frozen where frozen.campaign_id=c.id and frozen.revision=c.revision;
 return jsonb_build_object('audience','management','report',report);
end $$;
-- Fila temporal isolada. Só o worker do piloto a chama; nenhuma agenda legada é alterada.
create function cali_v2_disc.schedule(p_now timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare local_time timestamp:=p_now at time zone 'America/Sao_Paulo'; i record;kind text; amount integer:=0;
begin
 if extract(isodow from local_time)>5 or extract(hour from local_time)<8 or extract(hour from local_time)>=18 then return 0;end if;
 for i in select v.*,c.focal_email from cali_v2_disc.invites v join cali_v2_disc.campaigns c on c.id=v.campaign_id
 where c.status='open' and v.sent_at is not null loop
  if i.completed_at is null and i.declined_at is null and i.deadline_at>p_now then
   kind:=null;
   if p_now>=i.deadline_at-interval '24 hours' or (extract(isodow from local_time)=5 and extract(isodow from i.deadline_at at time zone 'America/Sao_Paulo') in(6,7) and i.deadline_at-p_now<=interval '64 hours') then kind:='reminder3';
   elsif i.opened_at is not null and p_now>=i.sent_at+(i.deadline_at-i.sent_at)/2 then kind:='reminder2';
   elsif i.opened_at is null and i.sent_at<=p_now-interval '24 hours' then kind:='reminder1';end if;
   if kind is not null then perform cali_v2_disc.queue(i.campaign_id,i.id,kind,i.email,kind||':'||i.id);end if;
  end if;
  if i.deadline_at<=p_now then kind:='focal_close';
  elsif p_now>=i.deadline_at-interval '24 hours' or (extract(isodow from local_time)=5 and extract(isodow from i.deadline_at at time zone 'America/Sao_Paulo') in(6,7) and i.deadline_at-p_now<=interval '64 hours') then kind:='focal_eve';else kind:=null;end if;
  if kind is not null then
   perform cali_v2_disc.queue(i.campaign_id,null,kind,i.focal_email,kind||':'||i.campaign_id||':'||i.deadline_at::text,
    jsonb_build_object('deadline',i.deadline_at,'pending',(select count(*) from cali_v2_disc.invites where campaign_id=i.campaign_id and completed_at is null and declined_at is null)));
  end if;
  amount:=amount+1;
 end loop;
 return amount;
end $$;
create function cali_workspace.v2_disc_worker(p_action text,p_job uuid default null,p_fields jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j cali_v2_disc.jobs;i cali_v2_disc.invites;c cali_v2_disc.campaigns;r cali_v2_disc.results;deadline timestamptz;
begin
 if p_action='authorize_hook' then return to_jsonb(exists(select 1 from cali_v2_disc.config where id and enabled and hook_secret=p_fields->>'secret'));
 elsif p_action='claim' then
  perform cali_v2_disc.schedule(statement_timestamp());
  select * into j from cali_v2_disc.jobs where (state='pending' or (state in('failed','processing') and lease_at<statement_timestamp()-interval '5 minutes')) and attempts<3 and (first_attempt_at is null or first_attempt_at>statement_timestamp()-interval '23 hours')
   order by created_at for update skip locked limit 1;
  if j.id is null then return null;end if;
  if not exists(select 1 from cali_v2_disc.allowed_recipients where email=j.recipient) then
   update cali_v2_disc.jobs set state='failed',error='Destinatário retirado da homologação.',attempts=3 where id=j.id;return null;end if;
  select * into c from cali_v2_disc.campaigns where id=j.campaign_id;
  select * into i from cali_v2_disc.invites where id=j.invite_id;
  if (j.kind='invite' and (c.status<>'open' or i.sent_at is not null or i.declined_at is not null or i.completed_at is not null))
   or (j.kind like 'reminder%' and (i.completed_at is not null or i.declined_at is not null or i.deadline_at<statement_timestamp() or c.status<>'open'))
   or (j.kind in('focal_eve','focal_close') and c.status<>'open')
   or (j.kind in('gestao_pdf','gestao_released') and (c.approved_at is null or c.revision<>(j.payload->'report'->>'revision')::integer)) then
   update cali_v2_disc.jobs set state='failed',error='Contexto alterado; envio cancelado.',attempts=3 where id=j.id;return null;end if;
  if j.kind='invite' then
   deadline:=((date_trunc('day',statement_timestamp() at time zone 'America/Sao_Paulo')+interval '7 days 23 hours 59 minutes') at time zone 'America/Sao_Paulo');
   update cali_v2_disc.invites set deadline_at=coalesce(deadline_at,deadline) where id=i.id returning * into i;
  end if;
  update cali_v2_disc.jobs set state='processing',lease_at=clock_timestamp(),first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1 where id=j.id;
  if j.kind='respondent_pdf' then select * into r from cali_v2_disc.results where invite_id=i.id;end if;
  return jsonb_build_object('id',j.id,'kind',j.kind,'recipient',j.recipient,'title',c.title,'organization',c.organization,'name',coalesce(i.person_name,j.payload->>'name',c.focal_name),
   'token',i.token,'deadline',i.deadline_at,'payload',j.payload,'created_at',j.created_at,
   'respondent',case when r.id is not null then jsonb_build_object('audience','respondent','title',c.title,'organization',c.organization,'protocol',r.protocol,'personName',r.person_name,
    'primary',r.primary_style,'secondary',r.secondary_style,'mixed',r.mixed,'createdAt',r.created_at,'signer',cali_workspace.profile_signer_snapshot()) else null end);
 elsif p_action='validate' then
  return to_jsonb(exists(select 1 from cali_v2_disc.jobs queued_job join cali_v2_disc.campaigns context_campaign on context_campaign.id=queued_job.campaign_id
   left join cali_v2_disc.invites context_invite on context_invite.id=queued_job.invite_id
   where queued_job.id=p_job and queued_job.state='processing' and exists(select 1 from cali_v2_disc.allowed_recipients a where a.email=queued_job.recipient)
    and (queued_job.kind not in('invite','reminder1','reminder2','reminder3','focal_eve','focal_close') or context_campaign.status='open')
    and (queued_job.kind not like 'reminder%' or (context_invite.completed_at is null and context_invite.declined_at is null and context_invite.deadline_at>statement_timestamp()))
    and (queued_job.kind not in('gestao_pdf','gestao_released') or (context_campaign.approved_at is not null and context_campaign.revision=(queued_job.payload->'report'->>'revision')::integer))));
 elsif p_action in('sent','failed') then
  select * into j from cali_v2_disc.jobs where id=p_job and state='processing' for update;
  if j.id is null then raise exception using errcode='22023',message='Envio não reservado.';end if;
  if p_action='sent' and nullif(p_fields->>'providerId','') is null then raise exception using errcode='22023',message='Provedor não confirmou o envio.';end if;
  update cali_v2_disc.jobs set state=p_action,finished_at=clock_timestamp(),provider_id=p_fields->>'providerId',error=case when p_action='failed' then left(p_fields->>'error',300) else null end where id=j.id;
  if p_action='sent' and j.kind='invite' then update cali_v2_disc.invites set sent_at=coalesce(sent_at,clock_timestamp()) where id=j.invite_id;end if;
  return jsonb_build_object('recorded',true);
 else raise exception using errcode='22023',message='Ação do worker inválida.';end if;
end $$;
-- Todos os objetos privados permanecem sem grants; wrappers públicos têm públicos distintos.
revoke all on all functions in schema cali_v2_disc from public,anon,authenticated,service_role;
revoke all on all sequences in schema cali_v2_disc from public,anon,authenticated,service_role;
revoke all on function cali_workspace.v2_disc_admin(uuid),cali_workspace.v2_disc_client(),
 cali_workspace.v2_disc_command(uuid,integer,uuid,text,jsonb),cali_workspace.v2_disc_document(uuid,uuid),
 cali_workspace.v2_disc_public(uuid,text,jsonb),cali_workspace.v2_disc_worker(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_disc_admin(uuid),cali_workspace.v2_disc_client(),
 cali_workspace.v2_disc_command(uuid,integer,uuid,text,jsonb),cali_workspace.v2_disc_document(uuid,uuid) to authenticated;
grant execute on function cali_workspace.v2_disc_public(uuid,text,jsonb) to anon,authenticated;
grant execute on function cali_workspace.v2_disc_worker(text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
