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
        className="tw:max-w-full tw:min-w-0 tw:overflow-x-auto tw:mobile:hidden"
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
      <div
        role="region"
        aria-label="Lista compacta de pessoas"
        className="tw:hidden tw:gap-3 tw:mobile:grid"
      >
        <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
          {directory.total} {directory.total === 1 ? 'registro' : 'registros'} no diretório
        </p>
        {directory.members.map((member) => (
          <details
            key={member.id}
            className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:p-3"
          >
            <summary className="tw:grid tw:min-h-11 tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-x-3 tw:gap-y-1 tw:font-semibold tw:wrap-anywhere">
              <span>{member.full_name}</span>
              <span className="tw:row-span-2 tw:text-caption tw:text-muted-copy">
                {member.archived_at ? teamStatusLabels.archived : teamStatusLabels[member.status]}
              </span>
              <span className="tw:text-caption tw:font-normal tw:text-muted-copy">
                {member.job_title} · {member.department}
              </span>
            </summary>
            <dl className="tw:my-3 tw:grid tw:grid-cols-2 tw:gap-3 tw:wrap-anywhere">
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Código</dt>
                <dd className="tw:m-0">{member.employee_code}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Gestão direta</dt>
                <dd className="tw:m-0">{member.manager_name ?? member.manager_code ?? '—'}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Admissão</dt>
                <dd className="tw:m-0">{formatCalendarDate(member.admission_date)}</dd>
              </div>
              <div>
                <dt className="tw:text-caption tw:text-muted-copy">Cargo e departamento</dt>
                <dd className="tw:m-0">
                  {member.job_title} · {member.department}
                </dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              className="tw:w-full"
              aria-label={`Ver ficha compacta de ${member.full_name}`}
              onClick={() => navigate({ member: member.id })}
            >
              Ver ficha
            </Button>
          </details>
        ))}
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
