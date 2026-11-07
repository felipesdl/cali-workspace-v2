-- FLOW-07. Corrige somente lançamento da empresa selecionada, com versão e auditoria.
begin;
set local lock_timeout='5s';
create function cali_workspace.v2_correct_pilot_hour(
  p_company_id uuid,p_request_id uuid,p_entry_id uuid,p_expected text,p_action text,p_reason text,
  p_date date default null,p_minutes integer default null,p_description text default null,p_visible boolean default null
)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC'
as $$
declare
  actor uuid := cali_session_guard.require_phase4_role(p_company_id,'admin');
  entry cali_workspace.hour_entries%rowtype;
  signature bytea;
  saved uuid;
begin
  if p_entry_id is null or not coalesce(p_expected ~ '^[0-9a-f]{64}$',false)
    or not coalesce(p_action in ('edit','delete'),false)
    or coalesce(length(btrim(p_reason)),0) not between 3 and 1000 then
    raise exception using errcode='22023',message='Confira a ação e informe a justificativa.';
  end if;
  if p_action='edit' and (p_date is null or not isfinite(p_date) or not coalesce(p_minutes between 1 and 1440,false)
    or coalesce(length(btrim(p_description)),0) not between 1 and 1000 or p_visible is null) then
    raise exception using errcode='22023',message='Confira data, duração e descrição.';
  end if;
  if p_action='delete' and (p_date is not null or p_minutes is not null or p_description is not null or p_visible is not null) then
    raise exception using errcode='22023',message='Dados de edição não se aplicam à exclusão.';
  end if;
  signature:=sha256(convert_to(jsonb_build_array('hour-correction',p_entry_id,p_expected,p_action,
    btrim(p_reason),p_date,p_minutes,btrim(p_description),p_visible)::text,'UTF8'));
  saved:=cali_session_guard.read_phase4_receipt(actor,p_company_id,p_request_id,signature);
  if saved is not null then return saved; end if;
  select * into entry from cali_workspace.hour_entries h
  where h.id=p_entry_id and h.company_id=p_company_id for update;
  if not found then
    raise exception using errcode='42501',message='Lançamento indisponível.';
  end if;
  if encode(sha256(convert_to(to_jsonb(entry)::text,'UTF8')),'hex') is distinct from p_expected then
    raise exception using errcode='40001',message='O lançamento mudou.';
  end if;
  case p_action
    when 'edit' then
      perform cali_workspace.edit_hour_entry_with_audit(entry.id,p_date,p_minutes,btrim(p_description),
        entry.category,p_visible,btrim(p_reason));
    when 'delete' then
      perform cali_workspace.delete_hour_entry_with_audit(entry.id,btrim(p_reason));
  end case;
  insert into cali_session_guard.phase4_operation_receipts
  values(actor,p_company_id,p_request_id,signature,p_entry_id);
  return p_entry_id;
end;
$$;
revoke all on function cali_workspace.v2_correct_pilot_hour(uuid,uuid,uuid,text,text,text,date,integer,text,boolean)
from public,anon,authenticated,service_role;
grant execute on function cali_workspace.v2_correct_pilot_hour(uuid,uuid,uuid,text,text,text,date,integer,text,boolean)
to authenticated;
notify pgrst,'reload schema';
commit;
