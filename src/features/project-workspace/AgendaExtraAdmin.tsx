import { useState } from 'react';
import {
  extraExpenseKind,
  type AgendaExtra,
  type AgendaOperations,
} from '../../api/modules/project-workspace/agenda';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

const expenseLabels: Record<(typeof extraExpenseKind.options)[number], string> = {
  transport: 'Deslocamento',
  parking: 'Estacionamento',
  food: 'Alimentação',
  extra_hours: 'Horas adicionais',
};

function amountInCents(fields: FormData) {
  const amount = String(fields.get('amount') ?? '').trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(amount))
    throw new Error('Informe o valor em reais com até duas casas decimais.');
  const [whole, fraction = ''] = amount.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 1 || cents > 100000000) throw new Error('Valor fora do limite permitido.');
  return cents;
}

function AmountField({ id }: { id: string }) {
  return (
    <Field id={id} label="Valor em reais">
      <input id={id} name="amount" inputMode="decimal" maxLength={10} required />
    </Field>
  );
}

export function AgendaExtraAdmin({
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
  const [kind, setKind] = useState<(typeof extraExpenseKind.options)[number]>(
    extraExpenseKind.enum.transport,
  );
  const [protocol, setProtocol] = useState('');
  const version = item.version;
  if (!item.canRecordExpense && (!item.canQuote || !version)) return null;
  return (
    <div className="tw:my-3 tw:grid tw:gap-3">
      {item.canQuote && version && (
        <ActionForm
          label="Salvar orçamento pendente"
          submit={async (fields, request) => {
            const saved = await agenda.quoteExtra(
              company,
              item.id,
              request,
              version,
              amountInCents(fields),
              String(fields.get('note') ?? ''),
            );
            await refresh();
            return saved;
          }}
        >
          {(prefix) => (
            <>
              <AmountField id={prefix + 'amount'} />
              <Field id={prefix + 'note'} label="Condições do orçamento">
                <textarea
                  id={prefix + 'note'}
                  name="note"
                  minLength={5}
                  maxLength={2000}
                  required
                />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {item.canRecordExpense && (
        <ActionForm
          label="Registrar despesa da visita"
          submit={(fields, request) =>
            agenda.recordExtraExpense(company, item.id, request, {
              kind,
              cents: amountInCents(fields),
              note: String(fields.get('note') ?? ''),
              hours: kind === 'extra_hours' ? Number(fields.get('hours')) : null,
              approval: String(fields.get('approval') ?? ''),
            })
          }
          saved={setProtocol}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'kind'} label="Tipo de despesa">
                <select
                  id={prefix + 'kind'}
                  value={kind}
                  onChange={(event) => setKind(extraExpenseKind.parse(event.target.value))}
                >
                  {extraExpenseKind.options.map((option) => (
                    <option key={option} value={option}>
                      {expenseLabels[option]}
                    </option>
                  ))}
                </select>
              </Field>
              <AmountField id={prefix + 'amount'} />
              {kind === 'extra_hours' && (
                <>
                  <Field id={prefix + 'hours'} label="Quantidade de horas">
                    <input
                      id={prefix + 'hours'}
                      name="hours"
                      type="number"
                      min="0.01"
                      max="999.99"
                      step="0.01"
                      required
                    />
                  </Field>
                  <Field id={prefix + 'approval'} label="Registro do orçamento aprovado">
                    <textarea
                      id={prefix + 'approval'}
                      name="approval"
                      minLength={5}
                      maxLength={2000}
                      required
                    />
                  </Field>
                </>
              )}
              <Field id={prefix + 'note'} label="Observação">
                <textarea id={prefix + 'note'} name="note" maxLength={2000} />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {protocol && <p role="status">Despesa registrada. Protocolo {protocol}.</p>}
    </div>
  );
}
