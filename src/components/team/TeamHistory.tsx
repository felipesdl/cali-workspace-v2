import { Input } from '../ds/field/Controls';
import { type z } from 'zod';
import { teamChange, type teamHistory, type teamStructure } from '../../api/shared/team/history';
import { teamPageSize, type TeamSearch } from '../../api/shared/team/schemas';
import { Button } from '../ds/button/Button';
import { FeedbackState } from '../ds/feedback/FeedbackState';
import { Field } from '../ds/field/Field';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { teamStatusLabels } from './presentation';

const changeLabels = {
  [teamChange.Admission]: 'Admissão',
  [teamChange.Promotion]: 'Mudança de cargo',
  [teamChange.Transfer]: 'Transferência',
  [teamChange.Manager]: 'Mudança de gestor',
  [teamChange.Contract]: 'Mudança de vínculo',
  [teamChange.Leave]: 'Afastamento',
  [teamChange.Return]: 'Retorno',
  [teamChange.Termination]: 'Desligamento',
  [teamChange.Correction]: 'Atualização de ficha',
  [teamChange.Archived]: 'Arquivamento',
  [teamChange.Reactivated]: 'Reativação',
} as const;

export function HistoryFilters({
  month,
  member,
  navigate,
}: {
  month: string;
  member: string | undefined;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  return (
    <div className="tw:mb-3 tw:flex tw:flex-wrap tw:items-end tw:gap-3">
      <Field id="team-history-month" label="Mês de referência">
        <Input
          id="team-history-month"
          type="month"
          value={month.slice(0, 7)}
          onChange={(event) => navigate({ month: event.currentTarget.value || undefined, page: 1 })}
        />
      </Field>
      {member && (
        <Button variant="secondary" onClick={() => navigate({ member: undefined, page: 1 })}>
          Ver histórico da equipe
        </Button>
      )}
    </div>
  );
}

export function TeamHistory({
  history,
  page,
  navigate,
}: {
  history: z.infer<typeof teamHistory>;
  page: number;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const pages = Math.max(
    1,
    Math.ceil(Math.max(history.total, history.snapshotCount) / teamPageSize),
  );
  return (
    <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wrap-anywhere">
      <section aria-label="Movimentações" className="tw:grid tw:gap-2">
        <h3 className="tw:font-bold">Movimentações</h3>
        {history.events.length === 0 && (
          <FeedbackState kind="empty">Nenhuma movimentação nesta página.</FeedbackState>
        )}
        <ul className="tw:m-0 tw:list-none tw:divide-y tw:divide-border-default tw:p-0">
          {history.events.map((event) => (
            <li key={event.id} className="tw:flex tw:flex-wrap tw:justify-between tw:gap-2 tw:py-2">
              <span>
                {event.full_name} · {changeLabels[event.kind]}
              </span>
              <time dateTime={event.created_at}>{formatServerInstant(event.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Quadro confirmado" className="tw:grid tw:gap-2">
        <h3 className="tw:font-bold">Quadro confirmado</h3>
        {!history.confirmed && (
          <FeedbackState kind="empty">Sem confirmação para este mês.</FeedbackState>
        )}
        {history.confirmed && history.snapshots.length === 0 && (
          <FeedbackState kind="empty">Nenhuma ficha confirmada nesta página.</FeedbackState>
        )}
        <ul className="tw:m-0 tw:list-none tw:divide-y tw:divide-border-default tw:p-0">
          {history.snapshots.map((snapshot) => (
            <li key={snapshot.member_id} className="tw:py-2">
              <strong>{snapshot.full_name}</strong> · {snapshot.job_title} · {snapshot.department} ·{' '}
              {teamStatusLabels[snapshot.status]}
              <p className="tw:text-caption tw:text-muted-copy">
                Admissão em {formatCalendarDate(snapshot.admission_date)}
                {snapshot.termination_date &&
                  ` · Desligamento em ${formatCalendarDate(snapshot.termination_date)}`}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {pages > 1 && (
        <nav
          aria-label="Paginação do histórico"
          className="tw:flex tw:flex-wrap tw:items-center tw:gap-3"
        >
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => navigate({ page: Math.min(page - 1, pages) })}
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
    </div>
  );
}

export function TeamStructure({ rows }: { rows: z.infer<typeof teamStructure> }) {
  if (rows.length === 0)
    return (
      <FeedbackState kind="empty">Nenhum vínculo atual para apresentar na estrutura.</FeedbackState>
    );
  const departments = [...new Set(rows.map((row) => row.department))];
  return (
    <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wrap-anywhere tw:wide:grid-cols-2">
      {departments.map((department) => (
        <section
          key={department}
          className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:p-3"
          aria-label={department}
        >
          <h3 className="tw:mb-2 tw:font-bold">{department}</h3>
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
            {rows
              .filter((row) => row.department === department)
              .map((group) => (
                <li
                  key={group.manager_code ?? 'unassigned'}
                  className="tw:flex tw:justify-between tw:gap-3"
                >
                  <span>
                    {group.manager_name ?? group.manager_code ?? 'Sem gestor direto informado'}
                  </span>
                  <span>
                    {group.total} {group.total === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
