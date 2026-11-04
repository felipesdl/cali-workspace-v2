import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { type DraftReview, type DraftSnapshot } from '../../api/modules/companies/onboarding';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';

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
}: {
  action: DraftReview['action'];
  expected: string | null;
  save: SaveReview;
  close: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [preimage] = useState(expected);
  const [reference, setReference] = useState('');
  const [revision, setRevision] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const confirms = action === 'confirmed';
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
        if (mutation.isPending || !note.trim() || (confirms && (!reference.trim() || !checked)))
          return;
        mutation.mutate(
          action === 'confirmed' ? { action, reference, revision, note } : { action, note },
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
          disabled={!note.trim() || (confirms && (!reference.trim() || !checked))}
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
}: {
  snapshot: DraftSnapshot;
  save: SaveReview;
  refresh: () => void;
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
              {event.document_revision && <> · Versão {event.document_revision}</>}
              <p className="tw:m-0">{event.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
