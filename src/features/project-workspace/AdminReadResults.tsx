import { type ReactNode } from 'react';
import {
  type AdminReadService,
  type AuditEvent,
  type OpportunityStatus,
  type ProposalStatus,
} from '../../api/modules/project-workspace/admin-read';
import { formatServerInstant } from '../../lib/dates';

const auditLabels = {
  report_draft_created: 'Criou rascunho de relatório',
  report_review: 'Iniciou revisão de relatório',
  report_approve: 'Aprovou relatório',
  report_pdf_generated: 'Gerou PDF de relatório',
  report_released_in_app: 'Publicou relatório no Workspace',
  report_reopen: 'Reabriu relatório',
  report_release_acknowledged: 'Registrou ciência do relatório',
  document_revision_added: 'Adicionou revisão de documento',
  document_published: 'Publicou documento',
  document_withdrawn: 'Retirou documento',
  deliverable_reopened: 'Reabriu entregável',
  deliverable_client_approved: 'Aprovou entregável',
  record_open: 'Abriu ocorrência',
  account_record_feedback: 'Avaliou ocorrência',
  record_reopen_requested: 'Solicitou reabertura de ocorrência',
  record_reopen_decided: 'Decidiu reabertura de ocorrência',
  agenda_change_requested: 'Pediu alteração de agenda',
  scheduling_event_not_occurred: 'Registrou reunião não realizada',
  notice_comment_hidden: 'Ocultou comentário de aviso',
  notice_comment_restored: 'Restaurou comentário de aviso',
  capacity_pause_recorded: 'Registrou pausa por capacidade',
  capacity_pause_resumed: 'Registrou retomada de capacidade',
  commercial_proposal_edited: 'Editou proposta comercial',
  commercial_proposal_approved: 'Aprovou proposta internamente',
  form_draft_created: 'Criou rascunho de formulário',
  form_draft_edited: 'Editou rascunho de formulário',
  form_open: 'Abriu formulário para respostas',
  form_closed: 'Encerrou formulário',
  form_response_triaged: 'Registrou triagem de formulário',
  satisfaction_followup_saved: 'Registrou acompanhamento de avaliação',
  agenda_change_decided: 'Decidiu alteração de agenda',
} as const satisfies Record<AuditEvent, string>;
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
} as const satisfies Record<OpportunityStatus, string>;
const proposalLabels = {
  rascunho: 'Rascunho',
  aprovada: 'Aprovada internamente',
  enviada: 'Enviada',
  aceita: 'Aceita no Portal',
  recusada: 'Recusada',
  expirada: 'Expirada',
} as const satisfies Record<ProposalStatus, string>;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const card = 'tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

export function AuditResults({
  entries,
}: {
  entries: Awaited<ReturnType<AdminReadService['audit']>>['entries'];
}) {
  return (
    <ol className="tw:grid tw:gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className={card}>
          <strong>{auditLabels[entry.event]}</strong>
          <p>
            {entry.actorName} · {formatServerInstant(entry.at)} (Brasília)
          </p>
          {(entry.protocol || entry.revision !== null) && (
            <p>
              {[entry.protocol, entry.revision !== null && `Revisão ${entry.revision}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function CommercialResults({
  entries,
  editor,
}: {
  entries: Awaited<ReturnType<AdminReadService['commercial']>>['entries'];
  editor?: (proposal: string) => ReactNode;
}) {
  return (
    <ul className="tw:grid tw:gap-2">
      {entries.map((entry) => (
        <li key={entry.proposalId ?? entry.opportunityId} className={card}>
          <strong>
            {entry.protocol ?? 'Oportunidade'} · {opportunityLabels[entry.opportunityStatus]}
          </strong>
          {entry.proposalStatus && (
            <p>
              {proposalLabels[entry.proposalStatus]}
              {entry.version && ` · Versão ${entry.version}`}
            </p>
          )}
          {entry.total !== null && <p>Valor registrado: {money.format(entry.total)}</p>}
          {entry.proposalId && entry.proposalStatus === 'rascunho' && editor?.(entry.proposalId)}
          {!entry.proposalId && <p>Sem proposta registrada.</p>}
          {entry.updatedAt && <p>Atualização: {formatServerInstant(entry.updatedAt)} (Brasília)</p>}
        </li>
      ))}
    </ul>
  );
}
