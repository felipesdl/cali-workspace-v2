import { useState } from 'react';
import {
  nextCycleStatus,
  serviceCycleStatus,
  type ServiceCycle,
} from '../../../../api/admin/companies/cycles';
import { useTransitionServiceCycle } from '../../../../api/admin/companies/hooks/useTransitionServiceCycle';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';

const actionLabels = {
  [serviceCycleStatus.Open]: 'Abrir ciclo',
  [serviceCycleStatus.Review]: 'Enviar para revisão',
  [serviceCycleStatus.Closed]: 'Encerrar ciclo',
} as const;

export function ServiceCycleAction({
  companyId,
  cycle,
}: {
  companyId: string;
  cycle: ServiceCycle;
}) {
  const transition = useTransitionServiceCycle(companyId, cycle);
  const [confirm, setConfirm] = useState(false);
  const next = nextCycleStatus[cycle.status];
  if (!next) return null;
  const label = actionLabels[next];
  return (
    <div className="tw:grid tw:gap-2">
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {confirm ? (
          <>
            <Button pending={transition.isPending} onClick={() => transition.mutate()}>
              {next === serviceCycleStatus.Closed ? 'Confirmar encerramento' : 'Confirmar mudança'}
            </Button>
            <Button
              variant="secondary"
              disabled={transition.isPending}
              onClick={() => {
                transition.reset();
                setConfirm(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            {label}
          </Button>
        )}
      </div>
      {transition.isError && <FeedbackState kind="error">{transition.error.message}</FeedbackState>}
    </div>
  );
}
