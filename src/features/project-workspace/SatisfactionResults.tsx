import { Select, TextArea } from '../../components/ds/field/Controls';
import {
  type FollowupTheme,
  type SatisfactionEntry,
} from '../../api/modules/project-workspace/admin-read';
import { Field } from '../../components/ds/field/Field';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

const themes = {
  prazo: 'Prazo',
  qualidade: 'Qualidade da entrega',
  comunicacao: 'Comunicação',
  atendimento: 'Atendimento',
  outro: 'Outro',
} as const satisfies Record<FollowupTheme, string>;

export function SatisfactionResults({
  entries,
  save,
}: {
  entries: SatisfactionEntry[];
  save?: (entry: SatisfactionEntry, theme: string, note: string) => Promise<string>;
}) {
  return (
    <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
      {entries.map((entry) => (
        <li
          key={entry.source + ':' + entry.response}
          className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4 tw:wrap-anywhere"
        >
          <strong>{entry.title}</strong>
          <p>
            {entry.source === 'record'
              ? 'Ocorrência'
              : entry.response.startsWith('correction:')
                ? 'Revisão de entregável'
                : 'Entregável'}
            {' · '}
            {entry.score}/5 · {formatServerInstant(entry.ratedAt)} (Brasília)
          </p>
          {entry.comment && <p>{entry.comment}</p>}
          <p>{entry.followup ? 'Acompanhamento registrado' : 'Aguardando acompanhamento'}</p>
          {entry.followup && (
            <p>
              {entry.followup.theme ? themes[entry.followup.theme] : 'Sem tema'}
              {entry.followup.note && ` · ${entry.followup.note}`}
            </p>
          )}
          {save && (
            <ActionForm
              label={entry.followup ? 'Atualizar acompanhamento' : 'Registrar acompanhamento'}
              submit={(fields) =>
                save(entry, String(fields.get('theme') ?? ''), String(fields.get('note') ?? ''))
              }
            >
              {(prefix) => (
                <>
                  <Field id={prefix + 'theme'} label="Tema">
                    <Select
                      id={prefix + 'theme'}
                      name="theme"
                      defaultValue={entry.followup?.theme ?? ''}
                    >
                      <option value="">Sem tema</option>
                      {Object.entries(themes).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={prefix + 'note'} label="Anotação interna">
                    <TextArea
                      id={prefix + 'note'}
                      name="note"
                      maxLength={2000}
                      defaultValue={entry.followup?.note ?? ''}
                    />
                  </Field>
                </>
              )}
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  );
}
