import { useState } from 'react';
import { type AgendaOperations } from '../../api/modules/project-workspace/agenda';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { Field } from '../../components/ds/field/Field';
import { ActionForm } from './ActionForm';

const options = ['first', 'second'] as const;

export function AgendaExtraRequest({
  company,
  agenda,
  refresh,
}: {
  company: string;
  agenda: AgendaOperations;
  refresh: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'remote' | 'in_person'>('remote');
  const visit = mode === 'in_person';
  return (
    <ActionForm
      label="Solicitar encontro adicional"
      submit={async (fields, request) => {
        const read = (key: string) => String(fields.get(key) ?? '');
        if (!fields.has('ack')) throw new Error('Confirme as condições do pedido.');
        const saved = await agenda.requestExtra(company, request, {
          mode,
          title: read('title'),
          purpose: read('purpose'),
          location: read('location'),
          starts: [read('first'), read('second')],
          minutes: visit ? 240 : read('duration') === '90' ? 90 : 60,
          ackName: read('ackName'),
          acknowledged: true,
        });
        await refresh();
        return saved;
      }}
    >
      {(prefix) => (
        <>
          <Field id={prefix + 'mode'} label="Formato adicional">
            <select
              id={prefix + 'mode'}
              value={mode}
              onChange={(event) =>
                setMode(event.target.value === 'in_person' ? 'in_person' : 'remote')
              }
            >
              <option value="remote">Online</option>
              <option value="in_person">Visita presencial</option>
            </select>
          </Field>
          <Field id={prefix + 'title'} label="Assunto">
            <input id={prefix + 'title'} name="title" minLength={2} maxLength={149} required />
          </Field>
          <Field id={prefix + 'purpose'} label="Finalidade">
            <textarea id={prefix + 'purpose'} name="purpose" maxLength={2000} />
          </Field>
          {visit ? (
            <>
              <Field id={prefix + 'location'} label="Endereço da visita">
                <input
                  id={prefix + 'location'}
                  name="location"
                  minLength={5}
                  maxLength={400}
                  required
                />
              </Field>
              <p>
                R$ 800,00 por até 4 horas. Acima disso, orçamento e aceite prévios. Deslocamento,
                estacionamento e alimentação necessária à parte, com comprovantes. Cancelamento ou
                ausência sem aviso ou justificativa pode gerar taxa de R$ 160,00 após avaliação da
                CALI. Conciliação no período da visita.
              </p>
              <p>
                Escolha dois horários úteis entre 9h e 16h, com 48 horas de antecedência e espaço
                para 4 horas.
              </p>
            </>
          ) : (
            <Field id={prefix + 'duration'} label="Duração e valor">
              <select id={prefix + 'duration'} name="duration">
                <option value="60">1 hora · R$ 200,00</option>
                <option value="90">1h30 · R$ 300,00</option>
              </select>
            </Field>
          )}
          {options.map((option, index) => (
            <Field
              key={option}
              id={prefix + option}
              label={`Início da opção ${index + 1} (Brasília)`}
            >
              <input id={prefix + option} name={option} type="datetime-local" required />
            </Field>
          ))}
          <Field id={prefix + 'ackName'} label="Nome completo">
            <input id={prefix + 'ackName'} name="ackName" minLength={5} maxLength={160} required />
          </Field>
          <Checkbox name="ack" required>
            Li e aceito o valor e as condições. O pedido depende da confirmação da CALI.
          </Checkbox>
        </>
      )}
    </ActionForm>
  );
}
