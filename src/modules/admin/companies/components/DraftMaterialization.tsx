import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../components/ds/button/Button';

export function DraftMaterialization({
  companyId,
  create,
  openCompany,
}: {
  companyId: string | null;
  create: () => Promise<string>;
  openCompany: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({ mutationFn: create, retry: false });
  const linkedCompany = companyId ?? mutation.data;

  if (linkedCompany) {
    return (
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <FeedbackMessage tone="success">Empresa criada na carteira.</FeedbackMessage>
        <Button variant="secondary" onClick={() => openCompany(linkedCompany)}>
          Abrir na carteira
        </Button>
      </div>
    );
  }

  return (
    <div className="tw:grid tw:gap-2">
      {confirming && (
        <p className="tw:m-0">
          Confirme a inclusão desta empresa na carteira. A adesão e os acessos têm etapas próprias.
        </p>
      )}
      {mutation.isError && <FeedbackMessage tone="error">{mutation.error.message}</FeedbackMessage>}
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {confirming ? (
          <>
            <Button pending={mutation.isPending} onClick={() => mutation.mutate()}>
              Confirmar criação da empresa
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                mutation.reset();
                setConfirming(false);
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button onClick={() => setConfirming(true)}>Criar empresa na carteira</Button>
        )}
      </div>
    </div>
  );
}
