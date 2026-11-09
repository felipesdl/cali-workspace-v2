import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { useEffect, useRef } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../lib/dates';
import { ActionForm } from '../../../components/workspace/ActionForm';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ExternalCommercialPage() {
  const { adminRead } = useRouteContext({ from: '__root__' });
  const receiptRef = useRef<HTMLParagraphElement>(null);
  const justAccepted = useRef(false);
  const token = window.location.hash.slice(1);
  const enabled = adminRead && /^[a-f0-9]{64}$/.test(token);
  const result = useQuery({
    queryKey: ['pilot-external-commercial', token],
    queryFn: enabled
      ? ({ signal }) => adminRead.externalCommercialOffer(token, false, signal)
      : skipToken,
    gcTime: 0,
    retry: false,
  });
  const offer = result.data;
  const acceptedAt = offer?.acceptedAt;
  useEffect(() => {
    if (!acceptedAt || !justAccepted.current) return;
    justAccepted.current = false;
    if (document.activeElement === document.body) receiptRef.current?.focus();
  }, [acceptedAt]);
  return (
    <main className="tw:mx-auto tw:grid tw:max-w-2xl tw:min-w-0 tw:gap-4 tw:p-6 tw:wrap-anywhere tw:text-copy tw:mobile:p-4">
      <h1 className="tw:text-section tw:text-brand">Proposta CALI de homologação</h1>
      {enabled && result.isPending && (
        <FeedbackState kind="loading">Carregando proposta…</FeedbackState>
      )}
      {enabled && result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível carregar a proposta.
        </FeedbackState>
      )}
      {(!enabled || (result.isSuccess && !offer)) && <p>Link de teste indisponível ou vencido.</p>}
      {enabled && offer && (
        <>
          <h2>
            {offer.protocol} · Versão {offer.version}
          </h2>
          <p>
            CALI Build {offer.package} · {offer.months} meses
          </p>
          <p>Mensalidade: {money.format(offer.total)}</p>
          {offer.paymentTerms && <p>{offer.paymentTerms}</p>}
          {offer.publicNotes && <p>{offer.publicNotes}</p>}
          <p>Validade: {formatServerInstant(offer.deadline)} (Brasília)</p>
          {offer.acceptedAt ? (
            <FeedbackMessage ref={receiptRef} tone="success" tabIndex={-1}>
              Aceite de teste registrado.
            </FeedbackMessage>
          ) : (
            <ActionForm
              label="Confirmar aceite de teste"
              submit={async () => {
                const accepted = await adminRead.externalCommercialOffer(token, true);
                if (!accepted?.acceptedAt)
                  throw new Error('Link de teste indisponível ou vencido.');
                justAccepted.current = true;
                await result.refetch();
                return accepted;
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
