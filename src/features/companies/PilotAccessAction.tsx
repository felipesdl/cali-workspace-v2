import { useState } from 'react';
import {
  usePilotAccess,
  type PilotAccessChange,
} from '../../api/modules/companies/hooks/usePilotAccess';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

export function PilotAccessAction({ companyId }: { companyId: string }) {
  const { state, change, enabled } = usePilotAccess(companyId);
  const [draft, setDraft] = useState<PilotAccessChange | null>(null);
  if (!enabled) return null;
  if (state.isError)
    return <FeedbackState kind="error">Vínculo do piloto indisponível.</FeedbackState>;
  if (!state.data) return null;

  const { revokedAt } = state.data;
  const confirm = draft?.revokedAt === revokedAt ? draft : null;
  const action = revokedAt ? 'Reautorizar' : 'Revogar';
  return (
    <div className="tw:mt-3 tw:grid tw:gap-2">
      {confirm && revokedAt && <p>O cliente precisará entrar com um novo código.</p>}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {confirm ? (
          <>
            <Button pending={change.isPending} onClick={() => change.mutate(confirm)}>
              {revokedAt ? 'Confirmar reautorização de teste' : 'Confirmar revogação de teste'}
            </Button>
            <Button
              variant="secondary"
              disabled={change.isPending}
              onClick={() => {
                change.reset();
                setDraft(null);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            disabled={change.isPending}
            onClick={() => {
              change.reset();
              setDraft({ revokedAt, requestId: crypto.randomUUID() });
            }}
          >
            {action} acesso de teste
          </Button>
        )}
      </div>
      {change.isError && <FeedbackState kind="error">{change.error.message}</FeedbackState>}
    </div>
  );
}
