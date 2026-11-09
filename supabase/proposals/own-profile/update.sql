-- FLOW-14. Edição dos dados básicos da própria conta no CALI MAPA.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_update_own_profile(p_expected jsonb, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  profile cali_workspace.profiles%rowtype;
  current_values jsonb;
  field text;
  max_length integer;
begin
  if actor is null
     or (cali_workspace.v2_read_terms_state() ->> 'accepted') is distinct from 'true' then
    raise exception using errcode = '42501', message = 'Acesso ao perfil indisponível.';
  end if;
  if jsonb_typeof(p_expected) is distinct from 'object'
     or jsonb_typeof(p_patch) is distinct from 'object'
     or p_patch = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Confira os dados do perfil.';
  end if;

  for field in select jsonb_object_keys(p_patch) loop
    max_length := case field
      when 'full_name' then 200 when 'job_title' then 160
      when 'phone' then 40 when 'whatsapp' then 40
    end;
    if max_length is null or not (p_expected ? field)
       or jsonb_typeof(p_patch -> field) not in ('string', 'null')
       or (field = 'full_name' and p_patch ->> field is null)
       or (p_patch ->> field is not null and (
           length(p_patch ->> field) not between 1 and max_length
           or btrim(p_patch ->> field, E' \t\r\n') is distinct from p_patch ->> field
       )) then
      raise exception using errcode = '22023', message = 'Confira os dados do perfil.';
    end if;
  end loop;

  select p.* into profile
  from cali_workspace.profiles p
  where p.id = actor and p.active and p.role in ('admin', 'client')
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Acesso ao perfil indisponível.';
  end if;

  current_values := jsonb_build_object(
    'full_name', profile.full_name, 'job_title', profile.job_title,
    'phone', profile.phone, 'whatsapp', profile.whatsapp
  );
  -- Repetir a mesma gravação após perda da resposta retorna o estado já salvo.
  if not current_values @> p_patch then
    if exists (
      select 1 from jsonb_object_keys(p_patch) as changed(key)
      where current_values -> changed.key is distinct from p_expected -> changed.key
        and current_values -> changed.key is distinct from p_patch -> changed.key
    ) then
      return jsonb_build_object('status', 'conflict');
    end if;

    update cali_workspace.profiles
    set full_name = (current_values || p_patch) ->> 'full_name',
        job_title = (current_values || p_patch) ->> 'job_title',
        phone = (current_values || p_patch) ->> 'phone',
        whatsapp = (current_values || p_patch) ->> 'whatsapp'
    where id = actor
    returning * into profile;
  end if;

  return jsonb_build_object(
    'status', 'saved', 'profile', jsonb_build_object(
      'id', profile.id, 'full_name', profile.full_name, 'job_title', profile.job_title,
      'email', profile.email, 'phone', profile.phone, 'whatsapp', profile.whatsapp
    )
  );
end;
$$;

revoke all on function cali_workspace.v2_update_own_profile(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_update_own_profile(jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
