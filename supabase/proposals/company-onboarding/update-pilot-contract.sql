-- Condições contratuais e referências administrativas de A/B.
begin;
set local lock_timeout = '5s';

create function cali_workspace.v2_update_pilot_company_contract(
  p_company_id uuid, p_expected_at timestamptz, p_values jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := cali_session_guard.require_pilot_admin_session();
  allowed constant text[] := array[
    'start_date', 'end_date', 'contract_type', 'contract_model',
    'auto_renew', 'contract_penalty_enabled', 'termination_penalty_type', 'termination_penalty_value',
    'termination_payment_days', 'termination_payment_rule', 'contract_penalty_text', 'contract_value',
    'billing_frequency', 'payment_method', 'billing_due_rule', 'billing_day',
    'billing_lead_days', 'payment_term_days', 'late_fee_percent', 'daily_interest_percent',
    'payment_notes', 'drive_folder_url', 'document_owner', 'document_notes'
  ];
  original cali_workspace.companies;
  proposed cali_workspace.companies;
  changed_fields jsonb;
begin
  if not exists (select 1 from cali_session_guard.pilot_companies where company_id = p_company_id) then
    raise exception using errcode = '22023', message = 'Empresa fora da homologação.';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object'
    or not (p_values ?& allowed) or (p_values - allowed) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Ficha administrativa inválida.';
  end if;

  select * into strict original from cali_workspace.companies where id = p_company_id for update;
  if p_expected_at is distinct from original.updated_at then
    raise exception using errcode = '40001', message = 'Ficha alterada. Recarregue antes de salvar.';
  end if;
  select * into proposed from jsonb_populate_record(original, p_values);
  proposed.contract_penalty_text := nullif(btrim(proposed.contract_penalty_text), '');
  proposed.payment_notes := nullif(btrim(proposed.payment_notes), '');
  proposed.drive_folder_url := nullif(btrim(proposed.drive_folder_url), '');
  proposed.document_owner := nullif(btrim(proposed.document_owner), '');
  proposed.document_notes := nullif(btrim(proposed.document_notes), '');
  proposed.billing_due_rule := coalesce(proposed.billing_due_rule, original.billing_due_rule);
  proposed.billing_lead_days := coalesce(proposed.billing_lead_days, original.billing_lead_days);
  proposed.termination_payment_days := coalesce(proposed.termination_payment_days, 0);
  proposed.termination_penalty_value := coalesce(proposed.termination_penalty_value, 0);
  proposed.late_fee_percent := coalesce(proposed.late_fee_percent, 0);
  proposed.daily_interest_percent := coalesce(proposed.daily_interest_percent, 0);

  if proposed.start_date > proposed.end_date or proposed.contract_value < 0
    or proposed.billing_day not between 1 and 31
    or proposed.contract_type not in ('CALI Partner', 'CALI Full', 'Outro')
    or proposed.contract_model not in ('Assessoria mensal', 'Projeto', 'Treinamento')
    or proposed.billing_frequency not in ('monthly', 'single', 'quarterly', 'custom')
    or proposed.payment_method not in ('pix', 'boleto', 'transfer', 'card', 'other')
    or proposed.drive_folder_url !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
    or greatest(length(proposed.contract_penalty_text), length(proposed.payment_notes),
      length(proposed.document_notes), length(proposed.drive_folder_url), length(proposed.document_owner)) > 5000
    or proposed.auto_renew is null or proposed.contract_penalty_enabled is null
    or proposed.termination_penalty_type is null or proposed.termination_payment_rule is null then
    raise exception using errcode = '22023', message = 'Confira os valores da ficha.';
  end if;

  select jsonb_agg(field) into changed_fields from (values
    ('start_date', original.start_date is distinct from proposed.start_date),
    ('end_date', original.end_date is distinct from proposed.end_date),
    ('contract_type', original.contract_type is distinct from proposed.contract_type),
    ('contract_model', original.contract_model is distinct from proposed.contract_model),
    ('auto_renew', original.auto_renew is distinct from proposed.auto_renew),
    ('contract_penalty_enabled', original.contract_penalty_enabled is distinct from proposed.contract_penalty_enabled),
    ('termination_penalty_type', original.termination_penalty_type is distinct from proposed.termination_penalty_type),
    ('termination_penalty_value', original.termination_penalty_value is distinct from proposed.termination_penalty_value),
    ('termination_payment_days', original.termination_payment_days is distinct from proposed.termination_payment_days),
    ('termination_payment_rule', original.termination_payment_rule is distinct from proposed.termination_payment_rule),
    ('contract_penalty_text', original.contract_penalty_text is distinct from proposed.contract_penalty_text),
    ('contract_value', original.contract_value is distinct from proposed.contract_value),
    ('billing_frequency', original.billing_frequency is distinct from proposed.billing_frequency),
    ('payment_method', original.payment_method is distinct from proposed.payment_method),
    ('billing_due_rule', original.billing_due_rule is distinct from proposed.billing_due_rule),
    ('billing_day', original.billing_day is distinct from proposed.billing_day),
    ('billing_lead_days', original.billing_lead_days is distinct from proposed.billing_lead_days),
    ('payment_term_days', original.payment_term_days is distinct from proposed.payment_term_days),
    ('late_fee_percent', original.late_fee_percent is distinct from proposed.late_fee_percent),
    ('daily_interest_percent', original.daily_interest_percent is distinct from proposed.daily_interest_percent),
    ('payment_notes', original.payment_notes is distinct from proposed.payment_notes),
    ('drive_folder_url', original.drive_folder_url is distinct from proposed.drive_folder_url),
    ('document_owner', original.document_owner is distinct from proposed.document_owner),
    ('document_notes', original.document_notes is distinct from proposed.document_notes)
  ) as comparison(field, changed) where changed;
  if changed_fields is null then return p_company_id; end if;

  update cali_workspace.companies set
    start_date = proposed.start_date,
    end_date = proposed.end_date,
    contract_type = proposed.contract_type,
    contract_model = proposed.contract_model,
    auto_renew = proposed.auto_renew,
    contract_penalty_enabled = proposed.contract_penalty_enabled,
    termination_penalty_type = proposed.termination_penalty_type,
    termination_penalty_value = proposed.termination_penalty_value,
    termination_payment_days = proposed.termination_payment_days,
    termination_payment_rule = proposed.termination_payment_rule,
    contract_penalty_text = proposed.contract_penalty_text,
    contract_value = proposed.contract_value,
    billing_frequency = proposed.billing_frequency,
    payment_method = proposed.payment_method,
    billing_due_rule = proposed.billing_due_rule,
    billing_day = proposed.billing_day,
    billing_lead_days = proposed.billing_lead_days,
    payment_term_days = proposed.payment_term_days,
    late_fee_percent = proposed.late_fee_percent,
    daily_interest_percent = proposed.daily_interest_percent,
    payment_notes = proposed.payment_notes,
    drive_folder_url = proposed.drive_folder_url,
    document_owner = proposed.document_owner,
    document_notes = proposed.document_notes
  where id = p_company_id;
  insert into cali_workspace.activity_log (company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values (p_company_id,actor,'v2_company_contract_updated','company',p_company_id,
    jsonb_build_object('fields',changed_fields));
  return p_company_id;
end;
$$;

revoke all on function cali_workspace.v2_update_pilot_company_contract(uuid,timestamptz,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function cali_workspace.v2_update_pilot_company_contract(uuid,timestamptz,jsonb)
  to authenticated;
notify pgrst, 'reload schema';
commit;
