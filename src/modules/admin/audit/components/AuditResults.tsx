import { type AdminReadService, type AuditEvent } from '../../../../api/admin/workspace/admin-read';

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
  commercial_proposal_created: 'Criou rascunho de proposta comercial',
  commercial_proposal_delivered: 'Enviou proposta pelo Workspace',
  commercial_proposal_accepted: 'Aceitou proposta comercial',
  commercial_proposal_approved: 'Aprovou proposta internamente',
  form_draft_created: 'Criou rascunho de formulário',
  form_draft_edited: 'Editou rascunho de formulário',
  form_open: 'Abriu formulário para respostas',
  form_closed: 'Encerrou formulário',
  form_response_triaged: 'Registrou triagem de formulário',
  form_responses_exported: 'Preparou exportação de respostas',
  satisfaction_followup_saved: 'Registrou acompanhamento de avaliação',
  agenda_change_decided: 'Decidiu alteração de agenda',
} as const satisfies Record<AuditEvent, string>;
const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

type AuditEntry = Awaited<ReturnType<AdminReadService['audit']>>['entries'][number];

export function AuditResults({ entries }: { entries: AuditEntry[] }) {
  const groups = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const day = dayFormat.format(new Date(entry.at));
    const group = groups.get(day);
    if (group) group.push(entry);
    else groups.set(day, [entry]);
  }

  return (
    <div className="tw:grid tw:min-w-0 tw:gap-[18px]" aria-label="Histórico em horário de Brasília">
      {[...groups].map(([day, items]) => (
        <section key={day}>
          <h2 className="tw:mt-0 tw:mb-2 tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-muted-copy tw:first-letter:uppercase">
            {day}
          </h2>
          <ol className="tw:m-0 tw:list-none tw:divide-y tw:divide-border-default tw:rounded-panel tw:border tw:border-border-default tw:bg-panel tw:p-0">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="tw:grid tw:min-w-0 tw:grid-cols-[46px_minmax(0,1fr)] tw:items-baseline tw:gap-x-3 tw:gap-y-1 tw:px-4 tw:py-3 tw:wrap-anywhere tw:min-[861px]:grid-cols-[46px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <time dateTime={entry.at} className="tw:text-[11px] tw:font-bold tw:text-brand">
                  {timeFormat.format(new Date(entry.at))}
                </time>
                <div className="tw:grid tw:gap-1">
                  <strong className="tw:text-[12px]">{auditLabels[entry.event]}</strong>
                  {entry.revision !== null && (
                    <small className="tw:text-[11px] tw:text-muted-copy">
                      Revisão {entry.revision}
                    </small>
                  )}
                </div>
                <div className="tw:col-start-2 tw:grid tw:gap-1 tw:min-[861px]:col-start-auto">
                  <small className="tw:text-[11px] tw:text-muted-copy">Protocolo</small>
                  <span>{entry.protocol || '—'}</span>
                </div>
                <div className="tw:col-start-2 tw:grid tw:gap-1 tw:min-[861px]:col-start-auto">
                  <small className="tw:text-[11px] tw:text-muted-copy">Quem</small>
                  <span>{entry.actorName}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
