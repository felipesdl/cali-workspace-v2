import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../../api/modules/access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatServerInstant } from '../../lib/dates';
import { ActionForm } from './ActionForm';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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
    <ul className="tw:grid tw:gap-4">
      {offers.data.map((offer) => (
        <li
          key={offer.id}
          className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4"
        >
          <h2 className="tw:text-section">
            {offer.protocol} · Versão {offer.version}
          </h2>
          <p>Valor: {money.format(offer.total)}</p>
          {offer.paymentTerms && <p>Condições: {offer.paymentTerms}</p>}
          {offer.publicNotes && <p>{offer.publicNotes}</p>}
          <p>Validade: {formatServerInstant(offer.acceptBy)} (Brasília)</p>
          {offer.acceptedAt && (
            <p role="status">
              Proposta aceita em {formatServerInstant(offer.acceptedAt)} (Brasília).
            </p>
          )}
          {offer.canAccept && (
            <ActionForm
              label="Aceitar proposta de teste"
              submit={async () => {
                const result = await adminRead.acceptCommercialOffer(
                  company,
                  offer.id,
                  offer.version,
                );
                await offers.refetch();
                return result;
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
