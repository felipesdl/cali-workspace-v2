import { useEffect, useRef, useState } from 'react';
import {
  usePilotInviteChange,
  type PilotAccessChange,
} from '../../api/modules/companies/hooks/usePilotAccess';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

export function PilotAccessAction({
  companyId,
  inviteId,
  revokedAt,
}: {
  companyId: string;
  inviteId: string;
  revokedAt: string | null;
}) {
  const change = usePilotInviteChange(companyId, inviteId);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<PilotAccessChange | null>(null);
  const confirm = draft?.revokedAt === revokedAt ? draft : null;
  const { isSuccess } = change;
  if (draft && !confirm) setDraft(null);
  useEffect(() => {
    if (isSuccess && !confirm && document.activeElement === document.body) {
      trigger.current?.focus();
    }
  }, [isSuccess, confirm]);
  const action = revokedAt ? 'Reautorizar' : 'Revogar';
  return (
    <div className="tw:mt-3 tw:grid tw:gap-2">
      {confirm && (
        <p className="tw:m-0 tw:text-caption tw:wrap-anywhere">
          {revokedAt
            ? 'O cliente precisará entrar com um novo código.'
            : 'Este acesso será bloqueado. Os demais acessos da empresa continuam disponíveis.'}
        </p>
      )}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {confirm ? (
          <>
            <Button pending={change.isPending} onClick={() => change.mutate(confirm)}>
              {revokedAt ? 'Confirmar reautorização de teste' : 'Confirmar revogação de teste'}
            </Button>
            <Button
              variant="secondary"
              autoFocus
              disabled={change.isPending}
              onClick={() => {
                change.reset();
                setDraft(null);
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            ref={trigger}
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
