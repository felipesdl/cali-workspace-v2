-- Ponte temporária de homologação. Sem endereço ou credencial no banco.
create table cali_session_guard.phase5_partner_otp_qa (
  id uuid primary key,
  server_hash bytea not null check(octet_length(server_hash)=32),
  expires_at timestamptz not null,
  code_hash bytea check(octet_length(code_hash)=32),
  delivered boolean not null default false,
  consumed boolean not null default false,
  attempts smallint not null default 0
);
alter table cali_session_guard.phase5_partner_otp_qa enable row level security;
revoke all on cali_session_guard.phase5_partner_otp_qa from public,anon,authenticated,service_role;

create function public.v2_partner_otp_qa(
  p_id uuid,p_key text,p_action text,p_code_hash text default null
)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  job cali_session_guard.phase5_partner_otp_qa;
  candidate bytea;
begin
  if p_id is null or p_key is null or length(p_key)<>64 then return false; end if;
  if p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  candidate:=decode(p_code_hash,'hex');
  select * into job from cali_session_guard.phase5_partner_otp_qa
    where id=p_id and server_hash=sha256(convert_to(p_key,'UTF8'))
      and expires_at>clock_timestamp() for update;
  if not found or job.consumed then return false; end if;
  case p_action
    when 'issue' then
      if candidate is null or job.code_hash is not null then return false; end if;
      update cali_session_guard.phase5_partner_otp_qa set code_hash=candidate where id=p_id;
    when 'delivered' then
      if job.code_hash is null or job.code_hash is distinct from candidate then return false; end if;
      update cali_session_guard.phase5_partner_otp_qa set delivered=true where id=p_id;
    when 'consume' then
      if candidate is null or not job.delivered or job.attempts>=5 then return false; end if;
      update cali_session_guard.phase5_partner_otp_qa set attempts=attempts+1,
        consumed=(job.code_hash=candidate) where id=p_id;
      return job.code_hash=candidate;
    else return false;
  end case;
  return true;
end;
$$;
revoke all on function public.v2_partner_otp_qa(uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.v2_partner_otp_qa(uuid,text,text,text) to anon;
