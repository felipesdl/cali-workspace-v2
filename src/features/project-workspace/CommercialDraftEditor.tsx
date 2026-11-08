import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  commercialScopeMode,
  type AdminReadService,
} from '../../api/modules/project-workspace/admin-read';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ActionForm } from './ActionForm';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function CreateCommercialDraft({
  company,
  actor,
  opportunity,
  service,
}: {
  company: string;
  actor?: string;
  opportunity: string;
  service: AdminReadService;
}) {
  const cache = useQueryClient();
  return (
    <ActionForm
      label="Criar rascunho de teste"
      submit={async () => {
        const result = await service.createCommercialDraft(company, opportunity);
        await Promise.all([
          cache.invalidateQueries({ queryKey: ['phase4-commercial', actor, company] }),
          cache.invalidateQueries({ queryKey: ['phase4-audit', actor, company] }),
        ]);
        return result;
      }}
    />
  );
}

export function SendCommercialOffer({
  company,
  actor,
  proposal,
  expected,
  service,
}: {
  company: string;
  actor?: string;
  proposal: string;
  expected: string;
  service: AdminReadService;
}) {
  const cache = useQueryClient();
  return (
    <ActionForm
      label="Enviar no Workspace de teste"
      submit={async () => {
        const result = await service.sendCommercialOffer(company, proposal, expected);
        await Promise.all([
          cache.invalidateQueries({ queryKey: ['phase4-commercial', actor, company] }),
          cache.invalidateQueries({ queryKey: ['phase4-audit', actor, company] }),
        ]);
        return result;
      }}
    />
  );
}

export function EmailCommercialOffer({
  company,
  proposal,
  expected,
  service,
}: {
  company: string;
  proposal: string;
  expected: string;
  service: AdminReadService;
}) {
  const [link, setLink] = useState<string>();
  return link ? (
    <div className="tw:grid tw:gap-2" role="status">
      <p>Envio confirmado pelo simulador de e-mail.</p>
      <a className="tw:text-brand tw:underline" href={link} target="_blank" rel="noreferrer">
        Abrir link do e-mail de teste
      </a>
    </div>
  ) : (
    <ActionForm
      label="Enviar PDF ao simulador"
      submit={() => service.emailCommercialOffer(company, proposal, expected)}
      saved={setLink}
    />
  );
}

export function CommercialDraftEditor({
  company,
  actor,
  proposal,
  service,
}: {
  company: string;
  actor?: string;
  proposal: string;
  service: AdminReadService;
}) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const key = ['phase4-commercial-draft', actor, company, proposal];
  const draft = useQuery({
    queryKey: key,
    queryFn: open ? ({ signal }) => service.commercialDraft(company, proposal, signal) : skipToken,
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: key }),
      cache.invalidateQueries({ queryKey: ['phase4-commercial', actor, company] }),
      cache.invalidateQueries({ queryKey: ['phase4-audit', actor, company] }),
    ]);
  }
  return (
    <div className="tw:my-3 tw:grid tw:gap-3">
      <div>
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Fechar editor' : 'Editar condições do rascunho'}
        </Button>
      </div>
      {open && draft.isPending && (
        <FeedbackState kind="loading">Carregando rascunho…</FeedbackState>
      )}
      {open && draft.isError && (
        <FeedbackState kind="error" onRetry={() => void draft.refetch()}>
          Não foi possível consultar o rascunho.
        </FeedbackState>
      )}
      {open && draft.isSuccess && !draft.data && (
        <p>Rascunho indisponível para seu acesso no Portal.</p>
      )}
      {open && draft.data && (
        <DraftFields
          key={draft.data.updatedAt}
          value={draft.data}
          company={company}
          service={service}
          refresh={refresh}
        />
      )}
    </div>
  );
}

function DraftFields({
  value,
  company,
  service,
  refresh,
}: {
  value: NonNullable<Awaited<ReturnType<AdminReadService['commercialDraft']>>>;
  company: string;
  service: AdminReadService;
  refresh: () => Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);
  const [pricingDirty, setPricingDirty] = useState(false);
  const pricing = value.pricing;
  const [scopeMode, setScopeMode] = useState(
    pricing?.scopeMode ?? commercialScopeMode.enum.integral,
  );
  const prioritized = scopeMode === commercialScopeMode.enum.prioritized;
  return (
    <div className="tw:grid tw:gap-2">
      {pricing && !dirty && (
        <ActionForm
          label={
            pricing.recurring === false
              ? 'Calcular e salvar investimento'
              : 'Calcular e salvar mensalidade'
          }
          submit={async (fields) => {
            const manual = String(fields.get('manualFinalAmount') ?? '').trim();
            const result = await service.priceCommercialDraft(company, value.id, value.updatedAt, {
              extras: Number(fields.get('extras')),
              discount: Number(fields.get('discount')),
              months: Number(fields.get('months')),
              options: pricing.scopeMode
                ? { scopeMode, manualFinalAmount: manual ? Number(manual) : null }
                : undefined,
            });
            await refresh();
            return result;
          }}
        >
          {(prefix) => (
            <>
              <p>
                {pricing.recurring === false ? 'Investimento atual' : 'Mensalidade atual'} ·{' '}
                {money.format(pricing.monthly)}
              </p>
              {pricing.scopeMode && (
                <Field id={prefix + 'scopeMode'} label="Escopo do cálculo">
                  <select
                    id={prefix + 'scopeMode'}
                    value={scopeMode}
                    onChange={(event) => {
                      setScopeMode(commercialScopeMode.parse(event.currentTarget.value));
                      setPricingDirty(true);
                    }}
                  >
                    <option value={commercialScopeMode.enum.integral}>Integral</option>
                    <option value={commercialScopeMode.enum.prioritized}>Priorizado</option>
                  </select>
                  {prioritized && <span>Usa a base do pacote sem adicionais.</span>}
                </Field>
              )}
              <Field id={prefix + 'extras'} label="Adicionais em reais">
                <input
                  id={prefix + 'extras'}
                  name="extras"
                  type="number"
                  min={0}
                  max={100000}
                  step="0.01"
                  required
                  disabled={prioritized}
                  defaultValue={pricing.extras}
                  onChange={() => setPricingDirty(true)}
                />
              </Field>
              {pricing.scopeMode && (
                <Field id={prefix + 'manualFinalAmount'} label="Valor final manual em reais">
                  <input
                    id={prefix + 'manualFinalAmount'}
                    name="manualFinalAmount"
                    type="number"
                    min={0.01}
                    max={100000}
                    step="0.01"
                    defaultValue={pricing.manualFinalAmount ?? ''}
                    onChange={() => setPricingDirty(true)}
                  />
                  <span>
                    Deixe em branco para calcular pelo desconto. A faixa do pacote continua válida.
                  </span>
                </Field>
              )}
              <Field id={prefix + 'discount'} label="Desconto em porcentagem">
                <input
                  id={prefix + 'discount'}
                  name="discount"
                  type="number"
                  min={0}
                  max={50}
                  step="0.01"
                  required
                  defaultValue={pricing.discount}
                  onChange={() => setPricingDirty(true)}
                />
              </Field>
              <Field id={prefix + 'months'} label="Duração em meses">
                <input
                  id={prefix + 'months'}
                  name="months"
                  type="number"
                  min={1}
                  max={60}
                  required
                  defaultValue={pricing.months}
                  onChange={() => setPricingDirty(true)}
                />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {!pricingDirty && (
        <ActionForm
          label="Salvar condições"
          submit={async (fields) => {
            const result = await service.saveCommercialDraft(company, value.id, value.updatedAt, {
              paymentTerms: String(fields.get('terms') ?? ''),
              publicNotes: String(fields.get('notes') ?? ''),
              validityDays: Number(fields.get('validity')),
            });
            await refresh();
            return result;
          }}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'terms'} label="Condições de pagamento">
                <textarea
                  id={prefix + 'terms'}
                  name="terms"
                  maxLength={2000}
                  defaultValue={value.paymentTerms ?? ''}
                  onChange={() => setDirty(true)}
                />
              </Field>
              <Field id={prefix + 'notes'} label="Observações da proposta">
                <textarea
                  id={prefix + 'notes'}
                  name="notes"
                  maxLength={4000}
                  defaultValue={value.publicNotes ?? ''}
                  onChange={() => setDirty(true)}
                />
              </Field>
              <Field id={prefix + 'validity'} label="Validade em dias">
                <input
                  id={prefix + 'validity'}
                  name="validity"
                  type="number"
                  min={1}
                  max={120}
                  required
                  defaultValue={value.validityDays}
                  onChange={() => setDirty(true)}
                />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {dirty || pricingDirty ? (
        <p>Salve as alterações antes de aprovar a proposta.</p>
      ) : (
        <ActionForm
          label="Aprovar versão internamente"
          submit={async () => {
            const result = await service.saveCommercialDraft(company, value.id, value.updatedAt);
            await refresh();
            return result;
          }}
        />
      )}
    </div>
  );
}
