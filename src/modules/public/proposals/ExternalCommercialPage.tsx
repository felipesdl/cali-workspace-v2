import { FeedbackMessage } from '../../../components/ds/feedback/FeedbackMessage';
import { useEffect, useRef } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../../lib/dates';
import { ActionForm } from '../../../components/workspace/ActionForm';
import { Panel } from '../../../components/ds/panel/Panel';

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
        <Panel className="tw:grid tw:gap-4 tw:p-6 tw:mobile:p-4">
          <header className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
            <div className="tw:grid tw:gap-1">
              <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
                {offer.protocol} · Versão {offer.version}
              </h2>
              <p className="tw:m-0 tw:text-muted-copy">
                CALI Build {offer.package} · {offer.months} meses
              </p>
            </div>
            <strong className="tw:text-section tw:text-brand">
              {money.format(offer.total)}
              <span className="tw:text-caption tw:font-normal"> / mês</span>
            </strong>
          </header>
          {offer.paymentTerms && <p className="tw:m-0">{offer.paymentTerms}</p>}
          {offer.publicNotes && (
            <p className="tw:m-0 tw:whitespace-pre-line">{offer.publicNotes}</p>
          )}
          <p className="tw:m-0 tw:text-muted-copy">
            Válida até {formatServerInstant(offer.deadline)} (Brasília)
          </p>
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
        </Panel>
      )}
    </main>
  );
}
