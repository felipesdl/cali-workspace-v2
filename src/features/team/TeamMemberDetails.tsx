import { parseTerminationReason } from '../../api/modules/team/termination';
import { type ProfessionalRecord } from '../../api/modules/team/schemas';
import { formatCalendarDate } from '../../lib/dates';
import {
  teamContractLabels,
  teamLabel,
  teamLeaveLabels,
  teamStatusLabels,
  teamWorkModels,
} from './presentation';

export function TeamMemberDetails({ member }: { member: ProfessionalRecord }) {
  const termination = parseTerminationReason(member.termination_reason);
  const fields = [
    ['Código', member.employee_code],
    ['Cargo', member.job_title],
    ['Departamento', member.department],
    ['Setor', member.team_area],
    ['Senioridade', member.seniority],
    ['Gestor direto (código)', member.manager_code],
    ['Liderança', member.is_leader ? 'Sim' : 'Não'],
    ['E-mail profissional', member.work_email],
    ['Telefone profissional', member.work_phone],
    ['Admissão', formatCalendarDate(member.admission_date)],
    ['Situação', member.archived_at ? teamStatusLabels.archived : teamStatusLabels[member.status]],
    ['Contratação', teamLabel(teamContractLabels, member.employment_type)],
    ['Jornada semanal', member.weekly_hours == null ? null : `${member.weekly_hours} h`],
    ['Modelo de trabalho', teamLabel(teamWorkModels, member.work_model)],
    ['Unidade / localidade', member.location],
    ['Categoria do afastamento', teamLabel(teamLeaveLabels, member.leave_reason)],
    [
      'Início do afastamento',
      member.leave_start_date && formatCalendarDate(member.leave_start_date),
    ],
    [
      'Previsão de retorno',
      member.expected_return_date && formatCalendarDate(member.expected_return_date),
    ],
    ['Desligamento', member.termination_date && formatCalendarDate(member.termination_date)],
    ['Iniciativa do desligamento', member.termination_initiative],
    ['Código eSocial', termination.code],
    ['Motivo do desligamento', termination.reason],
    ['Aviso prévio', member.notice_type],
  ];
  return (
    <>
      <h2 className="tw:mb-3 tw:text-section tw:font-bold tw:text-brand">{member.full_name}</h2>
      <dl className="tw:grid tw:grid-cols-3 tw:gap-3 tw:mobile:grid-cols-1">
        {fields
          .filter(([, value]) => value != null && value !== '')
          .map(([label, value]) => (
            <div key={label} className="tw:min-w-0 tw:wrap-anywhere">
              <dt className="tw:font-semibold">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </>
  );
}
