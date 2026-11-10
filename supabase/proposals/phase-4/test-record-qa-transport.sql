\ir record-qa-transport.sql
begin;
do $$
declare
 a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
 b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
 ticket uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
begin
 insert into cali_session_guard.phase4_record_qa(company_id,title) values(a,'[TESTE V2] Ocorrência sintética');
 insert into cali_workspace.account_records(id,company_id,title,visibility)
 values(ticket,a,'[TESTE V2] Ocorrência sintética','client'),(other,a,'Outra ocorrência','client');
 insert into cali_workspace.notifications values(a,ticket,'record_status','account_record',true),
   (a,other,'record_status','account_record',true),(b,ticket,'record_status','account_record',true);
 assert not (select email_required from cali_workspace.notifications where company_id=a and entity_id=ticket);
 assert (select email_required from cali_workspace.notifications where company_id=a and entity_id=other);
 assert (select email_required from cali_workspace.notifications where company_id=b and entity_id=ticket);
end $$;
rollback;
\echo Fase 4C: a ocorrência sintética fica no app sem alterar transporte de outros registros.
