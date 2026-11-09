import { Input, Select, TextArea } from '../../components/ds/field/Controls';
import { type ProjectJournalEntry } from '../../api/modules/project-workspace/project-journal';
import { type JournalSubmit } from './useJournalAction';
import { ActionForm } from './ActionForm';
import { Field } from '../../components/ds/field/Field';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { formatServerInstant, formatCalendarDate } from '../../lib/dates';
import { workspaceLabel } from './workspace-labels';

const note = (fields: FormData) => String(fields.get('note') ?? '');
export function Discussion({
  rows,
  admin,
  task,
  submit,
}: {
  rows: Extract<ProjectJournalEntry, { section: 'conversation' }>['rows'];
  admin: boolean;
  task: string | null;
  submit: JournalSubmit | null;
}) {
  return (
    <div className="tw:grid tw:gap-3">
      {rows.length ? (
        <ul className="tw:grid tw:gap-2">
          {rows.map((row) => (
            <li key={row.id} className="tw:border-b tw:border-border-default tw:pb-2">
              <p className="tw:text-note tw:text-muted">
                {row.role === 'client' ? 'Cliente' : 'CALI'} · {formatServerInstant(row.at)}
                {row.internal && ' · Nota interna'}
              </p>
              <p className="tw:break-words tw:whitespace-pre-wrap">{row.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma mensagem nesta conversa.</p>
      )}
      {submit && (
        <ActionForm
          label="Enviar mensagem"
          submit={(fields, id) =>
            submit(
              {
                action: 'message',
                fields: {
                  task,
                  note: note(fields),
                  internal: admin && fields.get('internal') === 'on',
                },
              },
              id,
            )
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'note'} label="Mensagem">
                <TextArea id={prefix + 'note'} name="note" required maxLength={5000} />
              </Field>
              {admin && <Checkbox name="internal">Nota interna da CALI</Checkbox>}
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}

export function Dependencies({
  rows,
  submit,
}: {
  rows: Extract<ProjectJournalEntry, { section: 'dependencies' }>['rows'];
  submit: JournalSubmit | null;
}) {
  return (
    <div className="tw:grid tw:gap-3">
      {rows.length ? (
        <ul className="tw:grid tw:gap-2">
          {rows.map((row) => (
            <li key={row.id} className="tw:grid tw:gap-2">
              <p>
                {row.title} · {workspaceLabel(row.status)} · Prazo {formatCalendarDate(row.due)}
              </p>
              {row.receivedAt && <p>Recebida em {formatServerInstant(row.receivedAt)}</p>}
              {submit && row.status === 'pending' && (
                <ActionForm
                  label="Atualizar dependência"
                  submit={(fields, id) =>
                    submit(
                      {
                        action: 'dependency-state',
                        fields: {
                          item: row.id,
                          status: fields.get('status') === 'received' ? 'received' : 'cancelled',
                        },
                      },
                      id,
                    )
                  }
                >
                  {(prefix) => (
                    <Field id={prefix + 'status'} label="Situação da dependência">
                      <Select id={prefix + 'status'} name="status" required defaultValue="">
                        <option value="" disabled>
                          Selecione
                        </option>
                        <option value="received">Recebida</option>
                        <option value="cancelled">Cancelada</option>
                      </Select>
                    </Field>
                  )}
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma dependência registrada.</p>
      )}
      {submit && (
        <ActionForm
          label="Solicitar retorno do Cliente"
          submit={(fields, id) =>
            submit(
              {
                action: 'dependency-create',
                fields: {
                  title: String(fields.get('title') ?? ''),
                  day: String(fields.get('day') ?? ''),
                },
              },
              id,
            )
          }
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'title'} label="Retorno necessário">
                <Input id={prefix + 'title'} name="title" maxLength={200} required />
              </Field>
              <Field id={prefix + 'day'} label="Prazo do retorno">
                <Input id={prefix + 'day'} name="day" type="date" required />
              </Field>
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
