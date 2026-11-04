import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  type AdhesionDocument,
  type DraftReview,
  type DraftSnapshot,
} from '../../api/modules/companies/onboarding';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';

type LoadDocuments = (signal: AbortSignal) => Promise<AdhesionDocument[]>;

type SaveReview = (
  requestId: string,
  expected: string | null,
  review: DraftReview,
) => Promise<void>;

function ReviewForm({
  action,
  expected,
  save,
  close,
  loadDocuments,
  documentQueryKey,
}: {
  action: DraftReview['action'];
  expected: string | null;
  save: SaveReview;
  close: () => void;
  loadDocuments?: LoadDocuments;
  documentQueryKey: readonly string[];
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [preimage] = useState(expected);
  const [reference, setReference] = useState('');
  const [revision, setRevision] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const confirms = action === 'confirmed';
  const [document, setDocument] = useState<AdhesionDocument>();
  const documents = useQuery({
    queryKey: documentQueryKey,
    queryFn: ({ signal }) => loadDocuments?.(signal) ?? [],
    enabled: Boolean(loadDocuments),
    gcTime: 0,
    retry: false,
  });
  const matchingVersion =
    document &&
    documents.data?.some(
      (option) =>
        option.document_id === document.document_id &&
        option.object_id === document.object_id &&
        option.version === document.version,
    );
  const canConfirm =
    reference.trim() &&
    checked &&
    (!loadDocuments || (matchingVersion && documents.isSuccess && !documents.isFetching));

  const mutation = useMutation({
    mutationFn: (input: DraftReview) => save(requestId, preimage, input),
    retry: false,
  });
  return (
    <form
      aria-label={confirms ? 'Confirmar comprovação' : 'Retirar comprovação'}
      className="tw:grid tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (mutation.isPending || !note.trim() || (confirms && !canConfirm)) return;
        mutation.mutate(
          action === 'confirmed'
            ? { action, reference, revision, note, document }
            : { action, note },
          { onSuccess: close },
        );
      }}
    >
      <fieldset
        disabled={mutation.isPending}
        className="tw:m-0 tw:grid tw:gap-3 tw:border-0 tw:p-0"
      >
        {confirms && (
          <>
            <Field id="draft-reference" label="Referência da adesão">
              <input
                id="draft-reference"
                autoFocus
                required
                maxLength={1000}
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  setChecked(false);
                }}
              />
            </Field>
            {loadDocuments ? (
              <>
                <Field id="draft-document" label="Contrato ou aditivo no Storage">
                  <select
                    id="draft-document"
                    required
                    value={matchingVersion ? document?.document_id : ''}
                    onChange={(event) => {
                      setDocument(
                        documents.data?.find((option) => option.document_id === event.target.value),
                      );
                      setChecked(false);
                    }}
                  >
                    <option value="">Selecione o documento</option>
                    {documents.data?.map((option) => (
                      <option key={option.document_id} value={option.document_id}>
                        {option.title} ·{' '}
                        {option.document_type === 'contract' ? 'Contrato' : 'Aditivo'} ·{' '}
                        {option.version}
                      </option>
                    ))}
                  </select>
                </Field>
                {documents.isFetching && <p role="status">Consultando documentos…</p>}
                {documents.isError && <p role="alert">Não foi possível consultar os documentos.</p>}
                {documents.isSuccess && documents.data.length === 0 && (
                  <p>Cadastre um contrato ou aditivo para esta empresa no Storage.</p>
                )}
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDocument(undefined);
                      setChecked(false);
                      void documents.refetch();
                    }}
                  >
                    Atualizar documentos
                  </Button>
                </div>
              </>
            ) : (
              <Field id="draft-revision" label="Versão informada do documento (opcional)">
                <input
                  id="draft-revision"
                  maxLength={250}
                  value={revision}
                  onChange={(event) => {
                    setRevision(event.target.value);
                    setChecked(false);
                  }}
                />
              </Field>
            )}
          </>
        )}
        <Field
          id="draft-note"
          label={confirms ? 'Observação da conferência' : 'Motivo da retirada'}
        >
          <textarea
            id="draft-note"
            autoFocus={!confirms}
            required
            maxLength={2000}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setChecked(false);
            }}
          />
        </Field>
        {confirms && (
          <label className="tw:flex tw:items-start tw:gap-2">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            Conferi a referência e a versão informada.
          </label>
        )}
      </fieldset>
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          type="submit"
          pending={mutation.isPending}
          disabled={!note.trim() || (confirms && !canConfirm)}
        >
          {confirms ? 'Salvar comprovação' : 'Confirmar retirada'}
        </Button>
        <Button variant="secondary" disabled={mutation.isPending} onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function DraftAdhesion({
  snapshot,
  save,
  refresh,
  loadDocuments,
  documentQueryKey,
}: {
  snapshot: DraftSnapshot;
  save: SaveReview;
  refresh: () => void;
  loadDocuments?: LoadDocuments;
  documentQueryKey: readonly string[];
}) {
  const [action, setAction] = useState<DraftReview['action'] | null>(null);
  const latest = snapshot.history[0];
  return (
    <section aria-label="Comprovação de adesão" className="tw:grid tw:gap-3">
      <h3 className="tw:m-0 tw:text-section tw:font-bold">{snapshot.draft.display_name}</h3>
      <p className="tw:m-0">Razão social: {snapshot.draft.legal_name}</p>
      <p className="tw:m-0">
        {latest?.action === 'confirmed'
          ? 'Comprovação registrada'
          : latest
            ? 'Comprovação retirada'
            : 'Aguardando comprovação'}
      </p>
      {action ? (
        <ReviewForm
          action={action}
          loadDocuments={action === 'confirmed' ? loadDocuments : undefined}
          documentQueryKey={documentQueryKey}
          expected={latest?.id ?? null}
          save={save}
          close={() => setAction(null)}
        />
      ) : (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button onClick={() => setAction('confirmed')}>Registrar comprovação</Button>
          {latest?.action === 'confirmed' && (
            <Button variant="secondary" onClick={() => setAction('withdrawn')}>
              Retirar comprovação
            </Button>
          )}
          <Button variant="secondary" onClick={refresh}>
            Atualizar histórico
          </Button>
        </div>
      )}
      {snapshot.history.length > 0 && (
        <ul aria-label="Histórico da comprovação" className="tw:m-0 tw:grid tw:gap-2 tw:pl-5">
          {snapshot.history.map((event) => (
            <li key={event.id} className="tw:wrap-anywhere">
              <strong>{event.action === 'confirmed' ? 'Confirmação' : 'Retirada'}</strong>
              {' · '}
              {formatServerInstant(event.recorded_at)}
              {event.evidence_reference && <> · {event.evidence_reference}</>}
              {event.document_snapshot ? (
                <>
                  {' '}
                  · {event.document_snapshot.title} · Versão do Storage{' '}
                  {event.document_snapshot.version}
                </>
              ) : event.document_revision ? (
                <> · Versão informada {event.document_revision}</>
              ) : null}
              <p className="tw:m-0">{event.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
