import { parseTerminationReason, teamTerminationCodes } from '../../api/modules/team/termination';
import { useId, useState } from 'react';
import { z } from 'zod';
import { type ProfessionalRecord, teamStatus } from '../../api/modules/team/schemas';
import {
  noticeTypes,
  terminationInitiatives,
  toProfessionalPatch,
  writeMonthOptions,
  type ProfessionalFields,
  type TeamSaveRow,
} from '../../api/modules/team/maintenance';
import { Button } from '../../components/ds/button/Button';
import { Checkbox } from '../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import {
  teamContractLabels,
  teamLeaveLabels,
  teamStatusLabels,
  teamWorkModels,
} from './presentation';

const professionalInputs = [
  { key: 'employee_code', label: 'Código do colaborador', maxLength: 60, required: true },
  { key: 'full_name', label: 'Nome completo', maxLength: 180, required: true },
  { key: 'job_title', label: 'Cargo', maxLength: 180, required: true },
  { key: 'department', label: 'Departamento', maxLength: 180, required: true },
  { key: 'admission_date', label: 'Data de admissão', type: 'date', required: true },
  { key: 'seniority', label: 'Senioridade', maxLength: 180 },
  { key: 'team_area', label: 'Setor', maxLength: 180 },
  { key: 'manager_code', label: 'Código do gestor direto', maxLength: 60 },
  { key: 'weekly_hours', label: 'Horas por semana', type: 'number', min: 0, max: 80, step: '0.01' },
  { key: 'location', label: 'Unidade / localidade', maxLength: 180 },
  { key: 'work_email', label: 'E-mail profissional', type: 'email', maxLength: 254 },
  { key: 'work_phone', label: 'Telefone profissional', type: 'tel', maxLength: 40 },
] satisfies ReadonlyArray<{
  key: keyof ProfessionalFields;
  label: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}>;

export function TeamMonthField({ id }: { id: string }) {
  return (
    <Field id={id} label="Mês de referência">
      <select id={id} name="month">
        {writeMonthOptions().map((month) => (
          <option key={month} value={`${month}-01`}>
            {month.slice(5)}/{month.slice(0, 4)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CatalogOptions({
  labels,
  current,
}: {
  labels: Readonly<Record<string, string>>;
  current?: string | null;
}) {
  return (
    <>
      {current && !Object.prototype.hasOwnProperty.call(labels, current) && (
        <option value={current}>{current}</option>
      )}
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

function LeaveFields({ prefix, member }: { prefix: string; member: ProfessionalRecord | null }) {
  return (
    <>
      <Field id={`${prefix}-leave-reason`} label="Categoria do afastamento">
        <select
          id={`${prefix}-leave-reason`}
          name="leave_reason"
          defaultValue={member?.leave_reason ?? ''}
        >
          <option value="">Não informada</option>
          <CatalogOptions labels={teamLeaveLabels} current={member?.leave_reason} />
        </select>
      </Field>
      <Field id={`${prefix}-leave-date`} label="Início do afastamento">
        <input
          id={`${prefix}-leave-date`}
          name="leave_start_date"
          type="date"
          required
          defaultValue={member?.leave_start_date ?? ''}
        />
      </Field>
      <Field id={`${prefix}-leave-return`} label="Previsão de retorno">
        <input
          id={`${prefix}-leave-return`}
          name="expected_return_date"
          type="date"
          defaultValue={member?.expected_return_date ?? ''}
        />
      </Field>
      <p className="tw:text-caption tw:text-muted-copy">
        Use uma categoria objetiva, sem incluir diagnóstico ou informação médica.
      </p>
    </>
  );
}

const initiativeLabels = {
  [terminationInitiatives.Employee]: 'Colaborador',
  [terminationInitiatives.Company]: 'Empresa',
  [terminationInitiatives.ContractEnd]: 'Fim do contrato',
  [terminationInitiatives.Other]: 'Outra',
} as const;
const noticeLabels = {
  [noticeTypes.Worked]: 'Trabalhado',
  [noticeTypes.Indemnified]: 'Indenizado',
  [noticeTypes.Waived]: 'Dispensado',
  [noticeTypes.NotApplicable]: 'Não se aplica',
} as const;

function TerminationFields({
  prefix,
  member,
}: {
  prefix: string;
  member: ProfessionalRecord | null;
}) {
  const termination = parseTerminationReason(member?.termination_reason);
  return (
    <>
      <Field id={`${prefix}-termination-date`} label="Data de desligamento">
        <input
          id={`${prefix}-termination-date`}
          name="termination_date"
          type="date"
          required
          defaultValue={member?.termination_date ?? ''}
        />
      </Field>
      <Field id={`${prefix}-termination-initiative`} label="Iniciativa do desligamento">
        <select
          id={`${prefix}-termination-initiative`}
          name="termination_initiative"
          defaultValue={member?.termination_initiative ?? ''}
        >
          <option value="">Não informada</option>
          {Object.entries(initiativeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-termination-code`} label="Código eSocial">
        <select
          id={`${prefix}-termination-code`}
          name="termination_code"
          defaultValue={termination.code}
        >
          <option value="">Não informado</option>
          {termination.code && !Object.keys(teamTerminationCodes).includes(termination.code) && (
            <option value={termination.code}>{termination.code} · código cadastrado</option>
          )}
          {Object.entries(teamTerminationCodes).map(([code, entry]) => (
            <option key={code} value={code}>
              {code} · {entry.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-termination-reason`} label="Motivo do desligamento">
        <input
          id={`${prefix}-termination-reason`}
          name="termination_reason"
          maxLength={180}
          defaultValue={termination.reason}
        />
      </Field>
      <Field id={`${prefix}-notice`} label="Aviso prévio">
        <select id={`${prefix}-notice`} name="notice_type" defaultValue={member?.notice_type ?? ''}>
          <option value="">Não informado</option>
          {Object.entries(noticeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function TeamEditor({
  member,
  pending,
  onSave,
  onCancel,
}: {
  member: ProfessionalRecord | null;
  pending: boolean;
  onSave: (month: string, row: TeamSaveRow) => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [original] = useState(member);
  const [status, setStatus] = useState(member?.status ?? teamStatus.Active);
  const [error, setError] = useState('');
  return (
    <form
      aria-label={member ? 'Editar ficha profissional' : 'Cadastrar pessoa'}
      className="tw:grid tw:gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const form = new FormData(event.currentTarget);
        try {
          await onSave(z.iso.date().parse(form.get('month')), {
            fields: toProfessionalPatch(form, original),
            expectedAt: original?.updated_at ?? null,
          });
        } catch (cause) {
          setError(
            cause instanceof z.ZodError
              ? 'Confira os campos destacados e os formatos informados.'
              : cause instanceof Error
                ? cause.message
                : 'Não foi possível salvar a ficha.',
          );
        }
      }}
    >
      <h2 className="tw:text-section tw:font-bold tw:text-brand">
        {member ? 'Editar ficha profissional' : 'Cadastrar pessoa'}
      </h2>
      <p className="tw:text-muted-copy">
        {member?.archived_at
          ? 'Salvar traz esta ficha de volta ao diretório e preserva o histórico.'
          : 'A ficha registra a pessoa na equipe da empresa.'}
      </p>
      <fieldset
        disabled={pending}
        className="tw:grid tw:min-w-0 tw:grid-cols-2 tw:gap-3 tw:mobile:grid-cols-1"
      >
        {professionalInputs.map(({ key, label, ...props }) => (
          <Field key={key} id={`${prefix}-${key}`} label={label}>
            <input
              {...props}
              id={`${prefix}-${key}`}
              name={key}
              readOnly={key === 'employee_code' && Boolean(member)}
              defaultValue={String(member?.[key] ?? '')}
            />
          </Field>
        ))}
        <Field id={`${prefix}-contract`} label="Tipo de contratação">
          <select
            id={`${prefix}-contract`}
            name="employment_type"
            defaultValue={member?.employment_type ?? 'clt'}
          >
            <CatalogOptions labels={teamContractLabels} current={member?.employment_type} />
          </select>
        </Field>
        <Field id={`${prefix}-work-model`} label="Modelo de trabalho">
          <select
            id={`${prefix}-work-model`}
            name="work_model"
            defaultValue={member?.work_model ?? ''}
          >
            <option value="">Não informado</option>
            <CatalogOptions labels={teamWorkModels} current={member?.work_model} />
          </select>
        </Field>
        <TeamMonthField id={`${prefix}-month`} />
        <Field id={`${prefix}-status`} label="Situação da pessoa">
          <select
            id={`${prefix}-status`}
            name="status"
            value={status}
            onChange={(event) => setStatus(z.enum(teamStatus).parse(event.currentTarget.value))}
          >
            {Object.values(teamStatus).map((value) => (
              <option key={value} value={value}>
                {teamStatusLabels[value]}
              </option>
            ))}
          </select>
        </Field>
        <Checkbox name="is_leader" defaultChecked={member?.is_leader}>
          Exerce função de liderança
        </Checkbox>
        {status === teamStatus.Leave && <LeaveFields prefix={prefix} member={member} />}
        {status === teamStatus.Terminated && <TerminationFields prefix={prefix} member={member} />}
      </fieldset>
      {error && <FeedbackState kind="error">{error}</FeedbackState>}
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <Button type="submit" pending={pending}>
          Salvar ficha
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
