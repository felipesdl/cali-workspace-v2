-- Rodar em transação revertida. Prova sem envio nem credencial real.
do $$
declare
  id uuid:=gen_random_uuid();
  key text:=repeat('a',64);
  digest text:=repeat('b',64);
begin
  insert into cali_session_guard.phase5_partner_otp_qa(id,server_hash,expires_at)
    values(id,sha256(convert_to(key,'UTF8')),clock_timestamp()+interval '1 minute');
  assert not has_table_privilege('anon','cali_session_guard.phase5_partner_otp_qa','select');
  set local role anon;
  assert not public.v2_partner_otp_qa(id,repeat('0',64),'issue',digest);
  assert public.v2_partner_otp_qa(id,key,'issue',digest);
  assert not public.v2_partner_otp_qa(id,key,'issue',digest);
  assert not public.v2_partner_otp_qa(id,key,'consume',digest);
  assert public.v2_partner_otp_qa(id,key,'delivered',digest);
  assert not public.v2_partner_otp_qa(id,key,'consume',repeat('c',64));
  assert public.v2_partner_otp_qa(id,key,'consume',digest);
  assert not public.v2_partner_otp_qa(id,key,'consume',digest);
  reset role;
  insert into cali_session_guard.phase5_partner_otp_qa(id,server_hash,expires_at,code_hash,delivered)
    values(gen_random_uuid(),sha256(convert_to(key,'UTF8')),clock_timestamp()-interval '1 minute',decode(digest,'hex'),true)
    returning phase5_partner_otp_qa.id into id;
  set local role anon;
  assert not public.v2_partner_otp_qa(id,key,'consume',digest);
  reset role;
end $$;
