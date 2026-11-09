import { FeedbackMessage } from '../../components/ds/feedback/FeedbackMessage';
import { useEffect, useRef } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { type AdminReadService } from '../../api/modules/project-workspace/admin-read';
import { useWorkspaceSession } from '../../api/modules/access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
type Offer = Awaited<ReturnType<AdminReadService['receivedOffers']>>[number];

function ReceivedOffer({
  offer,
  accept,
  refresh,
}: {
  offer: Offer;
  accept: () => Promise<string>;
  refresh: () => Promise<void>;
}) {
  const receipt = useRef<HTMLParagraphElement>(null);
  const justAccepted = useRef(false);
  const { acceptedAt } = offer;
  useEffect(() => {
    if (!acceptedAt || !justAccepted.current) return;
    justAccepted.current = false;
    if (document.activeElement === document.body) receipt.current?.focus();
  }, [acceptedAt]);

  return (
    <li className="tw:grid tw:min-w-0 tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4 tw:wrap-anywhere">
      <h2 className="tw:text-section">
        {offer.protocol} · Versão {offer.version}
      </h2>
      <p>Valor: {money.format(offer.total)}</p>
      {offer.paymentTerms && <p>Condições: {offer.paymentTerms}</p>}
      {offer.publicNotes && <p>{offer.publicNotes}</p>}
      <p>Validade: {formatServerInstant(offer.acceptBy)} (Brasília)</p>
      {acceptedAt && (
        <FeedbackMessage ref={receipt} tone="success" tabIndex={-1}>
          Proposta aceita em {formatServerInstant(acceptedAt)} (Brasília).
        </FeedbackMessage>
      )}
      {offer.canAccept && (
        <ActionForm
          label="Aceitar proposta de teste"
          submit={async () => {
            const result = await accept();
            justAccepted.current = true;
            await refresh();
            return result;
          }}
        />
      )}
    </li>
  );
}

export function ClientCommercialPage() {
  const { adminRead, domainOperations } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const company = profile?.company_id;
  const offers = useQuery({
    queryKey: ['phase4-received-offers', profile?.id, company],
    queryFn:
      adminRead &&
      domainOperations &&
      profile?.role === 'client' &&
      isPilotCompany(company ?? undefined) &&
      company
        ? ({ signal }) => adminRead.receivedOffers(company, signal)
        : skipToken,
  });

  if (!adminRead || !domainOperations || !company || !isPilotCompany(company))
    return <FeedbackState kind="empty">Propostas indisponíveis neste ambiente.</FeedbackState>;
  if (offers.isPending) return <FeedbackState kind="loading">Carregando propostas…</FeedbackState>;
  if (offers.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void offers.refetch()}>
        Não foi possível carregar as propostas.
      </FeedbackState>
    );
  if (!offers.data.length)
    return <FeedbackState kind="empty">Nenhuma proposta recebida.</FeedbackState>;

  return (
    <ul className="tw:m-0 tw:grid tw:list-none tw:gap-4 tw:p-0">
      {offers.data.map((offer) => (
        <ReceivedOffer
          key={offer.id}
          offer={offer}
          accept={() => adminRead.acceptCommercialOffer(company, offer.id, offer.version)}
          refresh={async () => {
            await offers.refetch();
          }}
        />
      ))}
    </ul>
  );
}
