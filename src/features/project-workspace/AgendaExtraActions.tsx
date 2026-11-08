import {
  type AgendaExtra,
  type AgendaOperations,
  type ExtraAgendaAction,
} from '../../api/modules/project-workspace/agenda';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

const labels: Record<ExtraAgendaAction, string> = {
  'book-visit': 'Confirmar visita pela CALI',
  offer: 'Oferecer horário',
  decline: 'Recusar pedido',
  fee: 'Registrar decisão de taxa',
  confirm: 'Confirmar horário',
  counter: 'Sugerir novas opções',
  cancel: 'Cancelar visita',
  reschedule: 'Reagendar visita',
};
const alternateOptions = [
  { id: 'first', number: 1 },
  { id: 'second', number: 2 },
] as const;

export function AgendaExtraActions({
  item,
  company,
  agenda,
  refresh,
}: {
  item: AgendaExtra;
  company: string;
  agenda: AgendaOperations;
  refresh: () => Promise<void>;
}) {
  const version = item.version;
  if (!version || !item.actions?.length) return null;
  return (
    <details>
      <summary>Ações do encontro adicional</summary>
      <div className="tw:mt-3 tw:grid tw:gap-3">
        {item.actions.map((action) => {
          const choices =
            action === 'confirm' ? (item.offeredSlots ?? []) : (item.requestedSlots ?? []);
          const offerVisit = action === 'offer' && item.mode === 'in_person';
          const choose =
            (action === 'offer' && !offerVisit) || action === 'book-visit' || action === 'confirm';
          const counter = action === 'counter' || action === 'reschedule';
          const requiresReason = action === 'fee' || action === 'cancel' || action === 'reschedule';
          if (choose && !choices.length) return null;
          return (
            <ActionForm
              key={action}
              label={labels[action]}
              submit={async (fields, request) => {
                const read = (name: string) => String(fields.get(name) ?? '');
                const result = await agenda.actOnExtra(company, item.id, request, version, action, {
                  index: choose ? Number(read('index')) : null,
                  note: read('note'),
                  slots: counter
                    ? [1, 2].map((i) => ({ start: read('start' + i), end: read('end' + i) }))
                    : [],
                  charge: action === 'fee' ? read('fee') === 'charge' : null,
                });
                await refresh();
                return result;
              }}
            >
              {(prefix) => (
                <>
                  {offerVisit && <p>As duas opções do pedido serão apresentadas ao Cliente.</p>}
                  {choose && (
                    <Field id={prefix + 'index'} label="Horário">
                      <select id={prefix + 'index'} name="index" defaultValue="" required>
                        <option value="" disabled>
                          Selecione
                        </option>
                        {choices.map((choice, index) => (
                          <option key={choice.startsAt} value={index}>
                            {formatServerInstant(choice.startsAt)} até{' '}
                            {formatServerInstant(choice.endsAt)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {counter &&
                    alternateOptions.map(({ id, number: i }) => (
                      <div key={id} className="tw:grid tw:gap-2">
                        <Field id={prefix + 'start' + i} label={`Início da opção ${i} (Brasília)`}>
                          <input
                            id={prefix + 'start' + i}
                            name={'start' + i}
                            type="datetime-local"
                            required
                          />
                        </Field>
                        <Field id={prefix + 'end' + i} label={`Fim da opção ${i} (Brasília)`}>
                          <input
                            id={prefix + 'end' + i}
                            name={'end' + i}
                            type="datetime-local"
                            required
                          />
                        </Field>
                      </div>
                    ))}
                  {action === 'fee' && (
                    <Field id={prefix + 'fee'} label="Decisão sobre a taxa">
                      <select id={prefix + 'fee'} name="fee" defaultValue="" required>
                        <option value="" disabled>
                          Selecione
                        </option>
                        <option value="waive">Sem taxa</option>
                        <option value="charge">Registrar R$ 160,00</option>
                      </select>
                    </Field>
                  )}
                  {action !== 'confirm' && action !== 'book-visit' && (
                    <Field id={prefix + 'note'} label={requiresReason ? 'Motivo' : 'Observação'}>
                      <textarea
                        id={prefix + 'note'}
                        name="note"
                        required={requiresReason}
                        minLength={requiresReason ? 5 : undefined}
                        maxLength={2000}
                      />
                    </Field>
                  )}
                </>
              )}
            </ActionForm>
          );
        })}
      </div>
    </details>
  );
}
