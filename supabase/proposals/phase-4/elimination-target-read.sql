-- Candidata privada de conferência do alvo inventariado. Executar em ensaio com rollback.
-- O resultado descreve o snapshot do banco. A operação no Storage exige proteção própria contra troca de objeto.
create function cali_session_guard.phase4_check_elimination_target(
  p_company_id uuid,
  p_closed_at timestamptz,
  p_bucket text,
  p_path text,
  p_object_id uuid,
  p_version text
)
returns text language plpgsql stable set search_path=''
as $$
declare
  current_object record;
begin
  if p_company_id is null or p_closed_at is null
    or p_bucket is null or p_bucket not in ('cali-workspace-private','workspace-assets')
    or nullif(btrim(p_path),'') is null or p_object_id is null
    or nullif(btrim(p_version),'') is null then
    raise exception using errcode='22023',message='Alvo da eliminação incompleto.';
  end if;

  if not exists(
    select 1 from cali_workspace.companies c
    where c.id=p_company_id and c.closed_at=p_closed_at
      and cali_workspace.company_elimination_ready(c.id)
  ) then
    return 'company_changed';
  end if;

  select o.id,o.version into current_object from storage.objects o
  where o.bucket_id=p_bucket and o.name=p_path;
  if found then
    if current_object.id=p_object_id and current_object.version=p_version then
      return 'same_object';
    end if;
    return 'object_changed';
  end if;

  if exists(select 1 from storage.objects o where o.id=p_object_id) then
    return 'object_changed';
  end if;
  return 'absent_at_check';
end;
$$;

revoke all on function cali_session_guard.phase4_check_elimination_target(uuid,timestamptz,text,text,uuid,text)
  from public,anon,authenticated,service_role;
