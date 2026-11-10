import {
  teamPageSize,
  type TeamDirectory as Directory,
  type TeamSearch,
} from '../../api/shared/team/schemas';
import { Button } from '../ds/button/Button';
import { formatCalendarDate } from '../../lib/dates';
import { teamStatusLabels } from './presentation';

export function TeamDirectory({
  directory,
  page,
  navigate,
}: {
  directory: Directory;
  page: number;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const pages = Math.max(1, Math.ceil(directory.total / teamPageSize));
  return (
    <>
      <div
        role="region"
        aria-label="Diretório de Equipe"
        tabIndex={0}
        className="tw:max-w-full tw:min-w-0 tw:overflow-x-auto"
      >
        <table className="tw:w-full tw:min-w-[34rem] tw:border-collapse tw:text-left tw:wrap-anywhere tw:[&_:is(th,td)]:border-b tw:[&_:is(th,td)]:border-border-default tw:[&_:is(th,td)]:p-3">
          <caption className="tw:pb-2 tw:text-left tw:text-muted-copy">
            {directory.total} {directory.total === 1 ? 'registro' : 'registros'} no diretório
          </caption>
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">Cargo e departamento</th>
              <th scope="col">Gestão direta</th>
              <th scope="col">Admissão</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {directory.members.map((member) => (
              <tr key={member.id}>
                <th scope="row">
                  <div className="tw:grid tw:max-w-64 tw:min-w-36 tw:justify-items-start tw:gap-2">
                    <div>
                      {member.full_name}
                      <span className="tw:block tw:text-caption tw:text-muted-copy">
                        {member.employee_code}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      aria-label={`Ver ficha de ${member.full_name}`}
                      onClick={() => navigate({ member: member.id })}
                    >
                      Ver ficha
                    </Button>
                  </div>
                </th>
                <td>
                  {member.job_title}
                  <span className="tw:block tw:text-caption">{member.department}</span>
                </td>
                <td>{member.manager_name ?? member.manager_code ?? '—'}</td>
                <td>{formatCalendarDate(member.admission_date)}</td>
                <td>
                  {member.archived_at ? teamStatusLabels.archived : teamStatusLabels[member.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav
          aria-label="Paginação da equipe"
          className="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:gap-3"
        >
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => navigate({ page: Math.min(pages, page - 1) })}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pages}
            onClick={() => navigate({ page: page + 1 })}
          >
            Próxima
          </Button>
        </nav>
      )}
    </>
  );
}
