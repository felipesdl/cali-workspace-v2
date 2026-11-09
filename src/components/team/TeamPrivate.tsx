import { FormActions } from '../ds/button/FormActions';
import { FeedbackMessage } from '../ds/feedback/FeedbackMessage';
import { Input, Select } from '../ds/field/Controls';
import { useId, useState } from 'react';
import { z } from 'zod';
import {
  children,
  gender,
  privateValuesFromForm,
  type TeamPrivateRecord,
  type TeamPrivateValues,
} from '../../api/shared/team/private-fields';
import { type ProfessionalRecord } from '../../api/shared/team/schemas';
import { useTeamPrivate } from '../../api/shared/team/useTeamPrivate';
import { Button } from '../ds/button/Button';
import { Checkbox } from '../ds/checkbox/Checkbox';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Field } from '../ds/field/Field';
import { formatCalendarDate } from '../../lib/dates';

const genders = {
  [gender.Female]: 'Feminino',
  [gender.Male]: 'Masculino',
  [gender.Other]: 'Outro',
  [gender.PreferNot]: 'Prefere não informar',
};
const families = {
  [children.Yes]: 'Sim',
  [children.No]: 'Não',
  [children.PreferNot]: 'Prefere não informar',
};
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function PrivateEditor({
  record,
  pending,
  onSave,
  onCancel,
}: {
  record: TeamPrivateRecord;
  pending: boolean;
  onSave: (
    record: TeamPrivateRecord,
    values: TeamPrivateValues,
    declared: boolean,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [original] = useState(record);
  const [identity, setIdentity] = useState(original.gender ?? '');
  const [error, setError] = useState('');
  return (
    <form
      aria-label="Editar dados privados"
      className="tw:grid tw:gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const form = new FormData(event.currentTarget);
        try {
          await onSave(original, privateValuesFromForm(form), form.has('declared'));
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível confirmar os dados privados.',
          );
        }
      }}
    >
      <fieldset
        disabled={pending}
        className="tw:m-0 tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:border-0 tw:p-0 tw:mobile:grid-cols-1"
      >
        <Field id={`${prefix}-salary`} label="Remuneração (R$)">
          <Input
            id={`${prefix}-salary`}
            name="salary"
            type="number"
            step="0.01"
            min="0"
            max="9999999999.99"
            defaultValue={original.salary ?? ''}
          />
        </Field>
        <Field id={`${prefix}-revision`} label="Última revisão salarial">
          <Input
            id={`${prefix}-revision`}
            name="salary_review_date"
            type="date"
            defaultValue={original.salary_review_date ?? ''}
          />
        </Field>
        <Field id={`${prefix}-gender`} label="Gênero">
          <Select
            id={`${prefix}-gender`}
            name="gender"
            value={identity}
            onChange={(event) =>
              setIdentity(z.union([z.literal(''), z.enum(gender)]).parse(event.currentTarget.value))
            }
          >
            <option value="">Não informado</option>
            {Object.entries(genders).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {identity === gender.Other && (
          <Field id={`${prefix}-gender-detail`} label="Descrição (opcional)">
            <Input
              id={`${prefix}-gender-detail`}
              name="gender_detail"
              maxLength={120}
              defaultValue={original.gender_detail ?? ''}
            />
          </Field>
        )}
        <Field id={`${prefix}-children`} label="Tem filhos">
          <Select
            id={`${prefix}-children`}
            name="has_children"
            defaultValue={original.has_children ?? ''}
          >
            <option value="">Não informado</option>
            {Object.entries(families).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox name="declared" required>
          Confirmo que tenho autorização para registrar estes dados.
        </Checkbox>
      </fieldset>
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <FormActions className="tw:max-w-md">
        <Button type="submit" pending={pending}>
          Salvar dados privados
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </FormActions>
    </form>
  );
}

function PrivateDetails({ member, onClose }: { member: ProfessionalRecord; onClose: () => void }) {
  const { query, save, enabled } = useTeamPrivate(member);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!enabled) return null;
  const record = query.data;
  return (
    <section
      className="tw:mt-4 tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:p-4"
      aria-label="Dados privados"
    >
      <h3 className="tw:font-bold tw:text-brand">Dados privados</h3>
      <p className="tw:text-muted-copy">
        Visíveis para a CALI e os acessos autorizados desta empresa. Use apenas os dados necessários
        para a ficha.
      </p>
      {query.isPending && <FeedbackState kind="loading">Carregando dados privados…</FeedbackState>}
      {query.isError && (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Não foi possível carregar os dados privados.
        </FeedbackState>
      )}
      {query.isSuccess && !record && (
        <FeedbackState kind="empty">Ficha indisponível.</FeedbackState>
      )}
      {record && editing && (
        <PrivateEditor
          record={record}
          pending={save.isPending}
          onCancel={() => setEditing(false)}
          onSave={async (original, values, declared) => {
            await save.mutateAsync({ record: original, values, declared });
            setEditing(false);
            setSaved(true);
          }}
        />
      )}
      {record && !editing && (
        <>
          <dl className="tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1">
            <div>
              <dt>Remuneração</dt>
              <dd>{record.salary == null ? 'Não informada' : currency.format(record.salary)}</dd>
            </div>
            <div>
              <dt>Última revisão salarial</dt>
              <dd>
                {record.salary_review_date
                  ? formatCalendarDate(record.salary_review_date)
                  : 'Não informada'}
              </dd>
            </div>
            <div>
              <dt>Gênero</dt>
              <dd>{record.gender ? genders[record.gender] : 'Não informado'}</dd>
            </div>
            {record.gender_detail && (
              <div>
                <dt>Descrição</dt>
                <dd>{record.gender_detail}</dd>
              </div>
            )}
            <div>
              <dt>Tem filhos</dt>
              <dd>{record.has_children ? families[record.has_children] : 'Não informado'}</dd>
            </div>
          </dl>
          {saved && <FeedbackMessage tone="success">Dados privados salvos.</FeedbackMessage>}
          {!member.archived_at && (
            <Button
              variant="secondary"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              Editar dados privados
            </Button>
          )}
        </>
      )}
      <Button variant="secondary" disabled={save.isPending} onClick={onClose}>
        Ocultar dados privados
      </Button>
    </section>
  );
}

export function TeamPrivate({ member }: { member: ProfessionalRecord }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <PrivateDetails member={member} onClose={() => setOpen(false)} />
  ) : (
    <Button variant="secondary" className="tw:mt-4" onClick={() => setOpen(true)}>
      Ver dados privados
    </Button>
  );
}
