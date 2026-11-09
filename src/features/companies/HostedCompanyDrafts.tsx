import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { Input } from '../../components/ds/field/Controls';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompaniesScope } from '../../api/modules/companies/hooks/useCompaniesScope';
import { companyKeys } from '../../api/modules/companies/keys';
import {
  isPilotCompany,
  type createCompanyOnboarding,
} from '../../api/modules/companies/onboarding';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { DraftAdhesion } from './DraftAdhesion';
import { DraftMaterialization } from './DraftMaterialization';

type Onboarding = ReturnType<typeof createCompanyOnboarding>;

function NewDraft({
  create,
  onCreated,
  close,
}: {
  create: Onboarding['create'];
  onCreated: (id: string) => void;
  close: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const mutation = useMutation({
    mutationFn: () => create(requestId, { displayName, legalName }),
    retry: false,
  });
  return (
    <form
      aria-label="Novo rascunho de empresa"
      className="tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!displayName.trim() || mutation.isPending) return;
        mutation.mutate(undefined, { onSuccess: (draft) => onCreated(draft.id) });
      }}
    >
      <Field id="draft-name" label="Nome de apresentação">
        <Input
          id="draft-name"
          autoFocus
          required
          maxLength={200}
          disabled={mutation.isPending}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </Field>
      <Field id="draft-legal-name" label="Razão social">
        <Input
          id="draft-legal-name"
          maxLength={200}
          disabled={mutation.isPending}
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
      </Field>
      {mutation.isError && <FeedbackMessage tone="error">{mutation.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" pending={mutation.isPending} disabled={!displayName.trim()}>
          Salvar rascunho
        </Button>
        <Button variant="secondary" disabled={mutation.isPending} onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Drafts({
  service,
  actor,
  openCompany,
  selectedCompanyId,
}: {
  service: Onboarding;
  actor: string;
  openCompany: (id: string) => void;
  selectedCompanyId?: string;
}) {
  const cache = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const before = pages[pages.length - 1] ?? null;
  const root = [...companyKeys.all(actor), 'onboarding'] as const;
  const listKey = [...root, 'list'] as const;
  const detailKey = [...root, 'draft', selected] as const;
  const list = useQuery({
    queryKey: [...listKey, before],
    queryFn: ({ signal }) => service.list(before, signal),
    retry: false,
  });
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => (selected ? service.read(selected, signal) : null),
    enabled: selected !== null,
    retry: false,
  });
  const prepare = useMutation({
    mutationFn: service.preparePilotDraft,
    retry: false,
    onSuccess: (id) => {
      setSelected(id);
      setPages([null]);
      void cache.invalidateQueries({ queryKey: listKey });
    },
  });
  const prepareDocument = useMutation({
    mutationFn: service.preparePilotDocument,
    retry: false,
    onSuccess: (_, companyId) => {
      if (detail.data?.draft.company_id === companyId) {
        void cache.invalidateQueries({ queryKey: [...root, 'documents', selected] });
      }
    },
  });
  const draftCompanyId = detail.data?.draft.company_id ?? undefined;
  const next = list.data?.next;
  return (
    <section
      aria-label="Rascunhos de empresas"
      className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">Rascunhos de empresas</h2>
      <p className="tw:m-0">
        Cadastre a empresa e registre a conferência da adesão. O rascunho fica separado da lista de
        empresas.
      </p>
      {creating ? (
        <NewDraft
          create={service.create}
          close={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
            setPages([null]);
            void cache.invalidateQueries({ queryKey: listKey });
          }}
        />
      ) : (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button onClick={() => setCreating(true)}>Novo rascunho de empresa</Button>
          {import.meta.env.DEV && selectedCompanyId && isPilotCompany(selectedCompanyId) && (
            <Button
              variant="secondary"
              pending={prepare.isPending}
              onClick={() => prepare.mutate(selectedCompanyId)}
            >
              Preparar rascunho da empresa de teste
            </Button>
          )}
        </div>
      )}
      {prepare.isError && <FeedbackMessage tone="error">{prepare.error.message}</FeedbackMessage>}
      {list.isPending && <p role="status">Carregando rascunhos…</p>}
      {list.isError && (
        <div>
          <FeedbackMessage tone="error">Não foi possível consultar os rascunhos.</FeedbackMessage>
          <Button variant="secondary" onClick={() => void list.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {list.isSuccess && (
        <>
          {list.data.items.length === 0 && <p className="tw:m-0">Nenhum rascunho nesta página.</p>}
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
            {list.data.items.map((draft) => (
              <li key={draft.id}>
                <Button
                  variant="secondary"
                  aria-pressed={selected === draft.id}
                  onClick={() => setSelected(draft.id)}
                >
                  {draft.display_name}
                </Button>
              </li>
            ))}
          </ul>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            {pages.length > 1 && (
              <Button variant="secondary" onClick={() => setPages(pages.slice(0, -1))}>
                Página anterior
              </Button>
            )}
            {next && (
              <Button variant="secondary" onClick={() => setPages([...pages, next])}>
                Próxima página
              </Button>
            )}
          </div>
        </>
      )}
      {selected && detail.isPending && <p role="status">Carregando comprovação…</p>}
      {detail.isError && (
        <div>
          <FeedbackMessage tone="error">Não foi possível consultar a comprovação.</FeedbackMessage>
          <Button variant="secondary" onClick={() => void detail.refetch()}>
            Recarregar comprovação
          </Button>
        </div>
      )}
      {selected && detail.isSuccess && !detail.data && (
        <FeedbackMessage tone="error">Rascunho indisponível.</FeedbackMessage>
      )}
      {selected && detail.isSuccess && detail.data && (
        <>
          {import.meta.env.DEV && draftCompanyId && isPilotCompany(draftCompanyId) && (
            <div>
              <Button
                variant="secondary"
                pending={prepareDocument.isPending}
                onClick={() => prepareDocument.mutate(draftCompanyId)}
              >
                Preparar contrato sintético de teste
              </Button>
              {prepareDocument.isError && (
                <FeedbackMessage tone="error">{prepareDocument.error.message}</FeedbackMessage>
              )}
            </div>
          )}
          <DraftAdhesion
            key={selected}
            snapshot={detail.data}
            documentQueryKey={[...root, 'documents', selected]}
            loadDocuments={
              detail.data.draft.company_id
                ? (signal) => service.documents(selected, signal)
                : undefined
            }
            refresh={() => void detail.refetch()}
            save={async (requestId, expected, input) => {
              await service.review(selected, requestId, expected, input);
              await cache.invalidateQueries({ queryKey: detailKey });
            }}
          />
          <DraftMaterialization
            key={`materialize:${selected}`}
            companyId={detail.data.draft.company_id}
            openCompany={openCompany}
            create={async () => {
              const id = await service.materialize(selected);
              await cache.invalidateQueries({ queryKey: companyKeys.all(actor) });
              return id;
            }}
          />
        </>
      )}
    </section>
  );
}

export function HostedCompanyDrafts({
  openCompany,
  selectedCompanyId,
}: {
  openCompany: (id: string) => void;
  selectedCompanyId?: string;
}) {
  const { actor, service, enabled } = useCompaniesScope();
  return enabled && service.onboarding ? (
    <Drafts
      key={actor}
      service={service.onboarding}
      actor={actor}
      openCompany={openCompany}
      selectedCompanyId={selectedCompanyId}
    />
  ) : null;
}
