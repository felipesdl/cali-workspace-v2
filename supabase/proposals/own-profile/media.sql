-- Complemento aditivo. Não altera a edição dos dados básicos nem seus GRANTs.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_update_own_profile_media(p_expected jsonb, p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  profile cali_workspace.profiles%rowtype;
  current_values jsonb;
  field text;
  url text;
  object_path text;
  columns constant text[] := array['avatar_url','avatar_position_x','avatar_position_y',
    'avatar_zoom','signature_mode','signature_url','signature_style'];
begin
  if actor is null or (cali_workspace.v2_read_terms_state()->>'accepted') is distinct from 'true' then
    raise exception using errcode='42501', message='Acesso ao perfil indisponível.';
  end if;
  select * into profile from cali_workspace.profiles p
    where p.id=actor and p.active and p.role in ('admin','client') for update;
  if not found then raise exception using errcode='42501', message='Perfil indisponível.'; end if;
  current_values := jsonb_build_object('avatar_url',profile.avatar_url,
    'avatar_position_x',coalesce(profile.avatar_position_x,50),
    'avatar_position_y',coalesce(profile.avatar_position_y,50),'avatar_zoom',coalesce(profile.avatar_zoom,1),
    'signature_mode',coalesce(profile.signature_mode,'generated'),'signature_url',profile.signature_url,
    'signature_style',coalesce(profile.signature_style,'calligraphic'));
  if jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
    or not (p_values ?& columns) or (p_values - columns) <> '{}'::jsonb
    or jsonb_typeof(p_values->'signature_mode') is distinct from 'string'
    or jsonb_typeof(p_values->'signature_style') is distinct from 'string'
    or p_values->>'signature_mode' not in ('generated','uploaded')
    or p_values->>'signature_style' not in ('executive','editorial','notarial','heritage','calligraphic','autograph','contemporary','italian','minimal','personal','classic','fluid','delicate','formal') then
    raise exception using errcode='22023', message='Confira foto e assinatura.';
  end if;
  foreach field in array array['avatar_position_x','avatar_position_y','avatar_zoom'] loop
    if jsonb_typeof(p_values->field) is distinct from 'number'
      or (p_values->>field)::numeric < case when field='avatar_zoom' then 1 else 0 end
      or (p_values->>field)::numeric > case when field='avatar_zoom' then 3 else 100 end then
      raise exception using errcode='22023', message='Posição de imagem inválida.';
    end if;
  end loop;
  foreach field in array array['avatar_url','signature_url'] loop
    if p_values->field = current_values->field then continue; end if;
    if p_values->field = 'null'::jsonb then continue; end if;
    url := p_values->>field;
    -- Imagens novas pertencem ao ator e precisam existir no bucket público já contratado.
    if jsonb_typeof(p_values->field) is distinct from 'string'
      or url !~ '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/workspace-assets/' then
      raise exception using errcode='22023', message='Origem da imagem inválida.';
    end if;
    object_path := split_part(url,'/workspace-assets/',2);
    if object_path !~ ('^'||actor::text||'/(avatar|signature)-[a-f0-9-]+[.](png|webp)$')
      or not exists(select 1 from storage.objects o where o.bucket_id='workspace-assets' and o.name=object_path) then
      raise exception using errcode='22023', message='Imagem indisponível.';
    end if;
  end loop;
  if p_values->>'signature_mode'='uploaded' and p_values->>'signature_url' is null then
    raise exception using errcode='22023', message='Selecione a imagem da assinatura.';
  end if;
  if current_values <> p_values and current_values is distinct from p_expected then
    raise exception using errcode='40001', message='Foto ou assinatura mudou em outra sessão.';
  end if;
  update cali_workspace.profiles set avatar_url=p_values->>'avatar_url',
    avatar_position_x=(p_values->>'avatar_position_x')::numeric,
    avatar_position_y=(p_values->>'avatar_position_y')::numeric,
    avatar_zoom=(p_values->>'avatar_zoom')::numeric,
    signature_mode=p_values->>'signature_mode',signature_url=p_values->>'signature_url',
    signature_style=p_values->>'signature_style' where id=actor;
  return p_values;
end $$;
revoke all on function cali_workspace.v2_update_own_profile_media(jsonb,jsonb) from public, anon, service_role;
grant execute on function cali_workspace.v2_update_own_profile_media(jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
