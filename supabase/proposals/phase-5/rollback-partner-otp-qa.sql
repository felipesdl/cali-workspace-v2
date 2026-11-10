drop function if exists public.v2_partner_otp_qa(uuid,text,text,text);
drop table if exists cali_session_guard.phase5_partner_otp_qa;
notify pgrst,'reload schema';
