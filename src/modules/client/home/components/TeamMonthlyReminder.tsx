import { Link } from '@tanstack/react-router';
import { useEffect, useRef, type RefObject } from 'react';
import { useTeamMonthly } from '../../../../api/shared/team/useTeamMonthly';
import { writeMonthOptions } from '../../../../api/shared/team/maintenance';
import { teamSearchSchema, teamViews } from '../../../../api/shared/team/schemas';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';

export function TeamMonthlyReminder({
  fallbackFocus,
}: {
  fallbackFocus: RefObject<HTMLHeadingElement>;
}) {
  const reference = writeMonthOptions()[1];
  const monthly = useTeamMonthly({ month: reference });
  const referenceLink = useRef<HTMLAnchorElement>(null);
  const errorRegion = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!restoreFocus.current || monthly.state.isFetching) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body) {
      (referenceLink.current ?? errorRegion.current ?? fallbackFocus.current)?.focus();
    }
  });
  function retry() {
    restoreFocus.current = true;
    void monthly.state.refetch();
  }
  if (!monthly.enabled || monthly.admin || monthly.state.isPending) return null;
  if (monthly.state.isError)
    return (
      <div ref={errorRegion} tabIndex={-1}>
        <FeedbackState kind="error" onRetry={retry}>
          Não foi possível verificar a conferência mensal da equipe.
        </FeedbackState>
      </div>
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
        ref={referenceLink}
        to="/cliente/equipe"
        search={teamSearchSchema.parse({ view: teamViews.Monthly, month: reference })}
        className="tw:text-brand tw:underline tw:underline-offset-4 tw:visited:text-brand tw:focus-visible:outline-2 tw:focus-visible:outline-focus"
      >
        Conferir referência
      </Link>
    </section>
  );
}
