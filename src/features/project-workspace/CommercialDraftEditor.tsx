import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { type AdminReadService } from '../../api/modules/project-workspace/admin-read';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { ActionForm } from './ActionForm';

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
  return (
    <div className="tw:grid tw:gap-2">
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
      {dirty ? (
        <p>Salve as condições antes de aprovar a proposta.</p>
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
