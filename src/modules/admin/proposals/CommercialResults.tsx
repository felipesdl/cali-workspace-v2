import { type ReactNode } from 'react';
import { type AdminReadService } from '../../../api/admin/workspace/admin-read';
import { formatServerInstant } from '../../../lib/dates';
import { Panel } from '../../../components/ds/panel/Panel';

type Entries = Awaited<ReturnType<AdminReadService['commercial']>>['entries'];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const opportunityLabels = {
  novo: 'Nova',
  analise: 'Em análise',
  edicao: 'Em edição',
  aprovada: 'Aprovada',
  enviada: 'Enviada',
  negociacao: 'Em negociação',
  fechada: 'Fechada',
  recusada: 'Recusada',
  expirada: 'Expirada',
} as const;
const proposalLabels = {
  rascunho: 'Rascunho',
  aprovada: 'Aprovada internamente',
  enviada: 'Enviada',
  aceita: 'Aceita no Portal',
  recusada: 'Recusada',
  expirada: 'Expirada',
} as const;

export function CommercialResults({
  entries,
  create,
  editor,
  send,
  email,
}: {
  entries: Entries;
  create?: (opportunity: string) => ReactNode;
  editor?: (proposal: string) => ReactNode;
  send?: (proposal: string, expected: string) => ReactNode;
  email?: (proposal: string, expected: string) => ReactNode;
}) {
  return (
    <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0">
      {entries.map((entry) => (
        <li key={entry.proposalId ?? entry.opportunityId}>
          <Panel className="tw:grid tw:min-w-0 tw:gap-3 tw:p-5 tw:wrap-anywhere">
            <header className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
              <div className="tw:grid tw:gap-1">
                <p className="tw:m-0 tw:text-caption tw:font-semibold tw:text-muted-copy">
                  {entry.protocol ?? 'Oportunidade'}
                </p>
                <h2 className="tw:m-0 tw:text-section tw:font-bold tw:text-brand">
                  {opportunityLabels[entry.opportunityStatus]}
                </h2>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  {entry.service}
                  {entry.package && ` · ${entry.package}`}
                </p>
              </div>
              {entry.total !== null && (
                <strong className="tw:text-section tw:text-brand">
                  {money.format(entry.total)}
                </strong>
              )}
            </header>
            {entry.proposalStatus && (
              <p className="tw:m-0 tw:text-muted-copy">
                {proposalLabels[entry.proposalStatus]}
                {entry.version && ` · Versão ${entry.version}`}
              </p>
            )}
            {!entry.proposalId && <p className="tw:m-0">Ainda não há proposta registrada.</p>}
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              {entry.proposalId &&
                entry.proposalStatus === 'rascunho' &&
                editor?.(entry.proposalId)}
              {!entry.proposalId && entry.canCreate && create?.(entry.opportunityId)}
              {entry.canSend &&
                entry.proposalId &&
                entry.updatedAt &&
                send?.(entry.proposalId, entry.updatedAt)}
              {entry.canEmail &&
                entry.proposalId &&
                entry.updatedAt &&
                email?.(entry.proposalId, entry.updatedAt)}
            </div>
            {entry.updatedAt && (
              <small className="tw:border-t tw:border-border-default tw:pt-3 tw:text-muted-copy">
                Atualizado em {formatServerInstant(entry.updatedAt)} (Brasília)
              </small>
            )}
          </Panel>
        </li>
      ))}
    </ul>
  );
}
