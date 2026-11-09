import { Select, TextArea } from '../ds/field/Controls';
import {
  type RecordFeedback,
  type RecordReopen,
  type RecordReviewAction,
} from '../../api/shared/workspace/domain-operations';
import { Field } from '../ds/field/Field';
import { ActionForm } from '../workspace/ActionForm';

const readNote = (fields: FormData) => String(fields.get('note') ?? '');
const reopenLabel = {
  pending: 'Em análise pela CALI',
  approved: 'Aprovada',
  rejected: 'Recusada',
} as const;
const reopeningStates = new Set(['completed', 'cancelled', 'standby']);

function Note({
  prefix,
  label,
  required = false,
  value,
}: {
  prefix: string;
  label: string;
  required?: boolean;
  value?: string | null;
}) {
  return (
    <Field id={prefix + 'note'} label={label}>
      <TextArea
        id={prefix + 'note'}
        name="note"
        required={required}
        minLength={required ? 3 : undefined}
        maxLength={2000}
        defaultValue={value ?? ''}
      />
    </Field>
  );
}

export function RecordReviewActions({
  admin,
  record,
  status,
  feedback,
  reopen,
  submit,
}: {
  admin: boolean;
  record: string;
  status?: string | null;
  feedback?: RecordFeedback | null;
  reopen?: RecordReopen | null;
  submit: (command: RecordReviewAction, id: string) => Promise<string>;
}) {
  const completed = status === 'completed';
  const canRequest = Boolean(status && reopeningStates.has(status)) && reopen?.status !== 'pending';
  return (
    <div className="tw:grid tw:gap-3">
      {!admin && completed && (
        <ActionForm
          label={feedback ? 'Atualizar avaliação' : 'Registrar avaliação'}
          submit={(fields, id) =>
            submit(
              {
                action: 'evaluate',
                record,
                score: Number(fields.get('score')),
                note: readNote(fields),
              },
              id,
            )
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'score'} label="Nota de 1 a 5">
                <Select
                  id={prefix + 'score'}
                  name="score"
                  required
                  defaultValue={feedback?.score ?? ''}
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={score}>
                      {score}
                    </option>
                  ))}
                </Select>
              </Field>
              <Note
                prefix={prefix}
                label="Comentário obrigatório para notas de 1 a 3"
                value={feedback?.comment}
              />
            </>
          )}
        </ActionForm>
      )}
      {reopen && (
        <div>
          <p>Reabertura · {reopenLabel[reopen.status]}</p>
          {reopen.reason && <p className="tw:break-words">Motivo: {reopen.reason}</p>}
          {reopen.note && <p className="tw:break-words">Resposta da CALI: {reopen.note}</p>}
        </div>
      )}
      {!admin &&
        canRequest &&
        (completed && !feedback ? (
          <p>Avalie a ocorrência para poder pedir a reabertura.</p>
        ) : (
          <ActionForm
            label="Solicitar reabertura"
            submit={(fields, id) =>
              submit({ action: 'request_reopen', record, note: readNote(fields) }, id)
            }
          >
            {(prefix) => <Note prefix={prefix} label="Motivo da reabertura" required />}
          </ActionForm>
        ))}
      {admin && reopen?.status === 'pending' && status && reopeningStates.has(status) && (
        <>
          <ActionForm
            label="Aprovar reabertura"
            submit={(fields, id) =>
              submit(
                { action: 'approve_reopen', record, reopen: reopen.id, note: readNote(fields) },
                id,
              )
            }
          >
            {(prefix) => <Note prefix={prefix} label="Mensagem para o Cliente" />}
          </ActionForm>
          <ActionForm
            label="Recusar reabertura"
            submit={(fields, id) =>
              submit(
                { action: 'reject_reopen', record, reopen: reopen.id, note: readNote(fields) },
                id,
              )
            }
          >
            {(prefix) => <Note prefix={prefix} label="Motivo da recusa" required />}
          </ActionForm>
        </>
      )}
    </div>
  );
}
