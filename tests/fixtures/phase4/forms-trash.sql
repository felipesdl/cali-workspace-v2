create table cali_workspace.forms_trash (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('form','responses')),
  form_id uuid not null,
  form_title text not null,
  form jsonb,
  responses jsonb not null default '[]',
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  restored_at timestamptz
);
create function cali_workspace.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from cali_workspace.profiles p where p.id=auth.uid() and p.active and p.role='admin');
$$;
create function cali_workspace.forms_trash_form() returns trigger
language plpgsql security definer set search_path='cali_workspace','public' as $$
begin
  insert into cali_workspace.forms_trash(kind,form_id,form_title,form,responses)
  values('form',old.id,old.title,to_jsonb(old),coalesce((
    select jsonb_agg(to_jsonb(r) order by r.submitted_at,r.id)
    from cali_workspace.form_responses r where r.form_id=old.id
  ),'[]'::jsonb));
  return old;
end;
$$;
create trigger forms_trash_form before delete on cali_workspace.forms
for each row execute function cali_workspace.forms_trash_form();

create function cali_workspace.forms_trash_responses() returns trigger
language plpgsql security definer set search_path='cali_workspace','public' as $$
begin
  insert into cali_workspace.forms_trash(kind,form_id,form_title,responses)
  select 'responses',d.form_id,coalesce(f.title,'Formulário'),jsonb_agg(to_jsonb(d) order by d.submitted_at,d.id)
  from deleted d left join cali_workspace.forms f on f.id=d.form_id
  where f.id is not null
  group by d.form_id,f.title;
  return null;
end;
$$;
create trigger forms_trash_responses after delete on cali_workspace.form_responses
referencing old table as deleted for each statement execute function cali_workspace.forms_trash_responses();

create function public.cali_forms_trash_restore(p_id uuid) returns jsonb
language plpgsql security definer set search_path='cali_workspace','public' as $$
declare item cali_workspace.forms_trash; restored_count integer;
begin
  if not cali_workspace.is_admin() then raise exception using errcode='42501',message='Sem permissão.'; end if;
  select * into item from cali_workspace.forms_trash where id=p_id and restored_at is null for update;
  if not found then raise exception using errcode='42501',message='Item não encontrado na lixeira.'; end if;
  if item.kind='form' then
    if exists(select 1 from cali_workspace.forms where id=item.form_id) then
      raise exception using errcode='40001',message='Este formulário já está na lista.';
    end if;
    if exists(select 1 from cali_workspace.forms where slug=item.form->>'slug') then
      raise exception using errcode='40001',message='Slug já está em uso.';
    end if;
    insert into cali_workspace.forms select * from jsonb_populate_record(null::cali_workspace.forms,item.form);
  elsif not exists(select 1 from cali_workspace.forms where id=item.form_id) then
    raise exception using errcode='40001',message='Restaure o formulário antes das respostas.';
  end if;
  insert into cali_workspace.form_responses
  select * from jsonb_populate_recordset(null::cali_workspace.form_responses,item.responses)
  on conflict(id) do nothing;
  get diagnostics restored_count=row_count;
  update cali_workspace.forms_trash set restored_at=now() where id=p_id;
  return jsonb_build_object('ok',true,'responses',restored_count);
end;
$$;
