import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompaniesScope } from '../../api/modules/companies/hooks/useCompaniesScope';
import { companyKeys } from '../../api/modules/companies/keys';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

export function PilotAccessRevocation({ companyId }: { companyId: string }) {
  const { service, actor, enabled } = useCompaniesScope();
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const revoke = useMutation({
    mutationFn: async () => {
      if (!enabled || !service.onboarding) throw new Error('Gestão de acesso indisponível.');
      await service.onboarding.revokePilotAccess(companyId);
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: companyKeys.accesses(actor, companyId) }),
  });
  if (!enabled || !service.onboarding) return null;

  return (
    <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
      {confirm ? (
        <>
          <Button pending={revoke.isPending} onClick={() => revoke.mutate()}>
            Confirmar revogação de teste
          </Button>
          <Button variant="secondary" disabled={revoke.isPending} onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            revoke.reset();
            setConfirm(true);
          }}
        >
          Revogar acesso de teste
        </Button>
      )}
      {revoke.isError && <FeedbackState kind="error">{revoke.error.message}</FeedbackState>}
    </div>
  );
}
