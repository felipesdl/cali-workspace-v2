-- Funções da referência f3d3f14 / 20261001110000; sem DML corretivo da migration.
-- Fixture para reproduzir bypass DEFINER, não candidata de implantação.
-- A pessoa principal é identificada pelo par empresa/e-mail após ativar a conta.
-- O convite permanece como origem dos dados enquanto o acesso ainda não existe.
create or replace function cali_workspace.update_my_profile_v56(
  p_full_name text, p_job_title text default null, p_phone text default null,
  p_avatar_url text default null, p_whatsapp text default null,
  p_linkedin_url text default null, p_instagram_url text default null,
  p_avatar_position_x numeric default 50, p_avatar_position_y numeric default 50,
  p_avatar_zoom numeric default 1, p_signature_mode text default 'generated',
  p_signature_url text default null, p_signature_style text default 'executive'
) returns cali_workspace.profiles
language plpgsql security definer set search_path to 'cali_workspace','public' as $$
declare updated_profile cali_workspace.profiles;
begin
  update cali_workspace.profiles set
    full_name=nullif(trim(p_full_name),''), job_title=nullif(trim(coalesce(p_job_title,'')),''),
    phone=nullif(trim(coalesce(p_phone,'')),''), avatar_url=nullif(trim(coalesce(p_avatar_url,'')),''),
    whatsapp=nullif(trim(coalesce(p_whatsapp,'')),''),
    linkedin_url=nullif(trim(coalesce(p_linkedin_url,'')),''),
    instagram_url=nullif(trim(coalesce(p_instagram_url,'')),''),
    avatar_position_x=greatest(0,least(100,coalesce(p_avatar_position_x,50))),
    avatar_position_y=greatest(0,least(100,coalesce(p_avatar_position_y,50))),
    avatar_zoom=greatest(1,least(3,coalesce(p_avatar_zoom,1))),
    signature_mode=case when p_signature_mode='uploaded' then 'uploaded' else 'generated' end,
    signature_url=nullif(trim(coalesce(p_signature_url,'')),''),
    signature_style=case when p_signature_style in (
      'executive','editorial','notarial','heritage','calligraphic','autograph',
      'contemporary','italian','minimal','personal','classic','fluid','delicate','formal'
    ) then p_signature_style else 'executive' end,
    updated_at=now()
  where id=auth.uid() returning * into updated_profile;
  if updated_profile.id is null then raise exception 'profile_not_found'; end if;
  if updated_profile.role='client' and updated_profile.is_primary and updated_profile.company_id is not null then
    update cali_workspace.client_invites set
      full_name=updated_profile.full_name, job_title=updated_profile.job_title,
      phone=updated_profile.phone, whatsapp=updated_profile.whatsapp
    where company_id=updated_profile.company_id and is_primary
      and lower(trim(email))=lower(trim(updated_profile.email));
  end if;
  return updated_profile;
end;$$;

create or replace function cali_workspace.update_primary_client_contact_v65(
  p_company_id uuid, p_full_name text, p_email text, p_job_title text,
  p_phone text, p_whatsapp text, p_birthday date
) returns void language plpgsql security definer set search_path to 'cali_workspace','public' as $$
declare existing_invite cali_workspace.client_invites; linked_profile cali_workspace.profiles;
begin
  if not cali_workspace.is_admin() then raise exception 'admin_required'; end if;
  select * into existing_invite from cali_workspace.client_invites
    where company_id=p_company_id and is_primary for update;
  if existing_invite.id is null then raise exception 'primary_invite_not_found'; end if;
  select * into linked_profile from cali_workspace.profiles
    where company_id=p_company_id and role='client' and is_primary
      and lower(trim(email))=lower(trim(existing_invite.email)) for update;
  if linked_profile.id is not null and lower(trim(p_email))<>lower(trim(existing_invite.email)) then
    raise exception 'linked_email_requires_access_management';
  end if;
  if nullif(trim(p_full_name),'') is null or nullif(trim(p_email),'') is null then
    raise exception 'contact_name_and_email_required';
  end if;
  update cali_workspace.client_invites set
    full_name=trim(p_full_name), email=lower(trim(p_email)),
    job_title=nullif(trim(coalesce(p_job_title,'')),''),
    phone=nullif(trim(coalesce(p_phone,'')),''),
    whatsapp=nullif(trim(coalesce(p_whatsapp,'')),''), birthday=p_birthday
  where id=existing_invite.id;
  if linked_profile.id is not null then
    update cali_workspace.profiles set
      full_name=trim(p_full_name), job_title=nullif(trim(coalesce(p_job_title,'')),''),
      phone=nullif(trim(coalesce(p_phone,'')),''),
      whatsapp=nullif(trim(coalesce(p_whatsapp,'')),''), updated_at=now()
    where id=linked_profile.id;
  end if;
end;$$;
revoke all on function cali_workspace.update_primary_client_contact_v65(uuid,text,text,text,text,text,date) from public;
grant execute on function cali_workspace.update_primary_client_contact_v65(uuid,text,text,text,text,text,date) to authenticated;
