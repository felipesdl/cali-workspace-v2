\ir notice-covers.sql
begin;
do $$
declare
  a constant uuid:='9c5ab148-78b8-4410-9338-58c44222a5db';
  b constant uuid:='6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76';
  notice uuid:=gen_random_uuid();
  operation uuid:=gen_random_uuid();
  version uuid;
  removed uuid;
  picture text:='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1sAAAAASUVORK5CYII=';
begin
  set local role authenticated;
  perform cali_workspace.fixture_as('admin');
  perform cali_workspace.v2_publish_pilot_notice(a,notice,'comunicado','Capa dirigida','Texto','2026-11-08');
  version:=cali_workspace.v2_save_pilot_notice_cover(a,notice,operation,null,'image/png',picture);
  assert cali_workspace.v2_save_pilot_notice_cover(a,notice,operation,null,'image/png',picture)=version;
  begin
    perform cali_workspace.v2_save_pilot_notice_cover(a,notice,gen_random_uuid(),null,'image/png',picture);
    raise exception 'Capa obsoleta sobrescrita';
  exception when serialization_failure then null; end;

  perform cali_workspace.fixture_as('clientA');
  assert exists(select 1 from jsonb_array_elements(cali_workspace.v2_read_pilot_catalog(a,'notices',null,1)->'entries') e
    where e->>'id'=notice::text and e->>'noticeCoverVersion'=version::text and e->>'noticeHasCover'='true');
  assert translate(cali_workspace.v2_read_pilot_notice_cover(a,notice,version)->>'content',chr(10),'')=picture;
  begin
    perform cali_workspace.v2_save_pilot_notice_cover(a,notice,gen_random_uuid(),version,null,null);
    raise exception 'Cliente alterou capa';
  exception when insufficient_privilege then null; end;

  perform cali_workspace.fixture_as('clientB');
  begin
    perform cali_workspace.v2_read_pilot_notice_cover(b,notice,version);
    raise exception 'B abriu capa de A';
  exception when insufficient_privilege then null; end;

  perform cali_workspace.fixture_as('admin');
  removed:=cali_workspace.v2_save_pilot_notice_cover(a,notice,gen_random_uuid(),version,null,null);
  assert removed<>version;
  begin
    perform cali_workspace.v2_read_pilot_notice_cover(a,notice,version);
    raise exception 'Capa retirada continua disponível';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
