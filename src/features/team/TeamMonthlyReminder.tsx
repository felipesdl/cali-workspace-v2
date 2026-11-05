import { Link } from '@tanstack/react-router';
import { useTeamMonthly } from '../../api/modules/team/useTeamMonthly';
import { writeMonthOptions } from '../../api/modules/team/maintenance';
import { teamSearchSchema, teamViews } from '../../api/modules/team/schemas';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

export function TeamMonthlyReminder() {
  const reference = writeMonthOptions()[1];
  const monthly = useTeamMonthly({ month: reference });
  if (!monthly.enabled || monthly.admin || monthly.state.isPending) return null;
  if (monthly.state.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void monthly.state.refetch()}>
        Não foi possível verificar a conferência mensal da equipe.
      </FeedbackState>
    );
  if (!monthly.state.data || monthly.state.data.review) return null;
  return (
    <section
      aria-label="Conferência mensal pendente"
      className="tw:grid tw:gap-3 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
    >
      <h2 className="tw:m-0 tw:text-section tw:text-brand">Confira os dados da equipe</h2>
      <p className="tw:m-0">
        A referência {reference.slice(5)}/{reference.slice(0, 4)} ainda não foi confirmada. Confira
        o quadro e as vagas, inclusive se não houve mudanças.
      </p>
      <Link
        to="/cliente/equipe"
        search={teamSearchSchema.parse({ view: teamViews.Monthly, month: reference })}
        className="tw:text-brand tw:underline tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-focus"
      >
        Conferir referência
      </Link>
    </section>
  );
}
