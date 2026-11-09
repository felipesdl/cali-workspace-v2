import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { companyStatusLabels } from '../companies/presentation';
import { ActionForm } from './ActionForm';
import { FileDownload } from './FileDownload';
import { type DomainOperations } from '../../api/modules/project-workspace/domain-operations';

const kinds = {
  access: 'Acesso aos dados',
  correction: 'Correção',
  deletion: 'Eliminação',
  other: 'Outro direito',
} as const;

export function DataLifecycleOverview({ company, actor }: { company: string; actor?: string }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const result = useQuery({
    queryKey: ['phase4-data-lifecycle', actor, company],
    queryFn: domainOperations
      ? ({ signal }) => domainOperations.dataLifecycle(company, signal)
      : skipToken,
  });
  if (!domainOperations) return null;
  return (
    <section aria-label="Ciclo de dados" className="tw:grid tw:gap-2">
      <h2 className="tw:text-section">Ciclo de dados</h2>
      {result.isPending && <FeedbackState kind="loading">Consultando conta…</FeedbackState>}
      {result.isError && (
        <FeedbackState kind="error" onRetry={() => void result.refetch()}>
          Não foi possível consultar o ciclo de dados.
        </FeedbackState>
      )}
      {result.data && (
        <dl className="tw:grid tw:gap-2">
          <div>
            <dt>Situação da conta</dt>
            <dd>{companyStatusLabels[result.data.status]}</dd>
          </div>
          <div>
            <dt>Acesso cortado pela situação da conta</dt>
            <dd>{result.data.accessClosed ? 'Sim' : 'Não'}</dd>
          </div>
          {result.data.closedAt && (
            <div>
              <dt>Encerramento registrado em</dt>
              <dd>{formatServerInstant(result.data.closedAt)}</dd>
            </div>
          )}
          {result.data.eliminatedAt ? (
            <div>
              <dt>Eliminação registrada em</dt>
              <dd>{formatServerInstant(result.data.eliminatedAt)}</dd>
            </div>
          ) : (
            <div>
              <dt>Intervalo de encerramento para análise de eliminação</dt>
              <dd>
                {result.data.waitingPeriodMet
                  ? 'Cumprido. Requer análise da CALI.'
                  : 'Não cumprido.'}
              </dd>
            </div>
          )}
        </dl>
      )}
      {result.data && !result.data.eliminatedAt && (
        <CompanyDataActions
          key={company}
          company={company}
          operations={domainOperations}
          eligible={result.data.waitingPeriodMet}
        />
      )}
    </section>
  );
}

function CompanyDataActions({
  company,
  operations,
  eligible,
}: {
  company: string;
  operations: DomainOperations;
  eligible: boolean;
}) {
  const [recipient, setRecipient] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState(false);
  const inventory = useQuery({
    queryKey: ['phase4-company-elimination-preview', company],
    queryFn:
      eligible && review
        ? ({ signal }) => operations.previewCompanyElimination(company, signal)
        : skipToken,
    gcTime: 0,
  });
  return (
    <div className="tw:grid tw:gap-3">
      <details>
        <summary>Exportação de dados da empresa</summary>
        <div className="tw:grid tw:gap-2">
          <Field id="company-export-recipient" label="Destinatário autorizado">
            <input
              id="company-export-recipient"
              value={recipient}
              maxLength={200}
              onChange={(event) => {
                setRecipient(event.currentTarget.value);
                setConfirmed(false);
              }}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            Confirmo que o destinatário pode receber os dados restritos deste arquivo.
          </label>
          {recipient.trim().length >= 3 && confirmed && (
            <FileDownload
              label="Baixar dados em JSON"
              download={(signal) => operations.exportCompanyData(company, recipient.trim(), signal)}
            />
          )}
        </div>
      </details>
      {eligible && (
        <div>
          <Button variant="secondary" onClick={() => setReview(!review)} aria-expanded={review}>
            Conferir eliminação
          </Button>
          {review && inventory.isPending && (
            <FeedbackState kind="loading">Preparando a conferência…</FeedbackState>
          )}
          {review && inventory.isError && (
            <FeedbackState kind="error" onRetry={() => void inventory.refetch()}>
              Não foi possível conferir a eliminação.
            </FeedbackState>
          )}
          {review && inventory.data?.eligible && (
            <>
              <p>
                {inventory.data.legacyStorageObjects} arquivo(s) no inventário legado ·{' '}
                {inventory.data.forms} formulário(s) · {inventory.data.formsPdfs} PDF(s) de Forms
              </p>
              {inventory.data.coverageReview ? (
                <>
                  <ul aria-label="Itens que exigem conferência adicional">
                    <li>
                      {inventory.data.coverageReview.pathsOutsideLegacy} caminho(s) fora do
                      inventário legado
                    </li>
                    <li>
                      {inventory.data.coverageReview.externalReferences} referência(s) a arquivos
                      externos
                    </li>
                    <li>
                      DISC: {inventory.data.coverageReview.discCampaigns} campanha(s),{' '}
                      {inventory.data.coverageReview.discResults} resultado(s) e{' '}
                      {inventory.data.coverageReview.discDispatches} registro(s) de envio
                    </li>
                  </ul>
                  <p>A prévia não confirma a exclusão dos dados nem de cópias externas.</p>
                </>
              ) : (
                <p>A conferência de vínculos externos e dados DISC está indisponível.</p>
              )}
              {inventory.data.workspaceFiles ? (
                <ul aria-label="Arquivos do Workspace V2">
                  <li>
                    {inventory.data.workspaceFiles.documentRevisions} revisão(ões) de documentos
                  </li>
                  <li>{inventory.data.workspaceFiles.recordAttachments} anexo(s) de ocorrências</li>
                  <li>{inventory.data.workspaceFiles.reportPdfs} PDF(s) de relatórios</li>
                  <li>{inventory.data.workspaceFiles.agendaPdfs} PDF(s) de encontros</li>
                  <li>
                    {inventory.data.workspaceFiles.expenseReceipts} comprovante(s) de despesas
                  </li>
                  <li>
                    {inventory.data.workspaceFiles.proposalPdfs} PDF(s) de propostas vinculadas
                  </li>
                  <li>
                    {inventory.data.workspaceFiles.exclusiveNoticeCovers} capa(s) de avisos
                    exclusivos
                  </li>
                </ul>
              ) : (
                <p>O inventário ampliado de arquivos V2 está indisponível neste ambiente.</p>
              )}
            </>
          )}
          {review && inventory.data?.eligible === false && (
            <p>A empresa ainda não atende ao intervalo para eliminação.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PrivacyActions({
  company,
  actor,
  admin = false,
}: {
  company: string;
  actor?: string;
  admin?: boolean;
}) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const key = ['phase4-privacy', actor, company];
  const requests = useQuery({
    queryKey: [...key, page],
    queryFn: domainOperations
      ? ({ signal }) => domainOperations.privacyRequests(company, page, signal)
      : skipToken,
  });
  if (!domainOperations) return null;
  const operations = domainOperations;
  async function refreshed(result: string) {
    await cache.invalidateQueries({ queryKey: key });
    return result;
  }
  return (
    <section aria-label="Pedidos de privacidade" className="tw:grid tw:gap-3">
      <h2 className="tw:text-section">
        {admin ? 'Pedidos da empresa' : 'Meus pedidos de privacidade'}
      </h2>
      {!admin && (
        <ActionForm
          label="Registrar pedido de privacidade"
          submit={async (fields, id) =>
            refreshed(
              await operations.submitPrivacy(
                company,
                id,
                String(fields.get('kind')),
                String(fields.get('details') ?? ''),
              ),
            )
          }
          saved={() => setPage(1)}
        >
          {(prefix) => (
            <>
              <Field id={prefix + 'kind'} label="Tipo de pedido">
                <select id={prefix + 'kind'} name="kind" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {Object.entries(kinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={prefix + 'details'} label="Descrição do pedido">
                <textarea
                  id={prefix + 'details'}
                  name="details"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </Field>
            </>
          )}
        </ActionForm>
      )}
      {requests.isPending && <p role="status">Carregando pedidos…</p>}
      {requests.isError && <p role="alert">Não foi possível carregar os pedidos.</p>}
      {requests.data?.length === 0 && <p>Nenhum pedido nesta página.</p>}
      {requests.data?.map((request) => (
        <article
          key={request.id}
          className="tw:grid tw:gap-2 tw:rounded-control tw:border tw:border-border-default tw:p-4"
        >
          <h3>
            {kinds[request.kind]} · {formatServerInstant(request.created_at)}
          </h3>
          <p className="tw:break-words tw:whitespace-pre-line">{request.details}</p>
          {request.answer && (
            <p className="tw:break-words tw:whitespace-pre-line">{request.answer}</p>
          )}
          {admin && request.status === 'open' && (
            <ActionForm
              label="Responder pedido"
              submit={async (fields) =>
                refreshed(
                  await operations.answerPrivacy(
                    company,
                    request.id,
                    String(fields.get('answer') ?? ''),
                  ),
                )
              }
            >
              {(prefix) => (
                <Field id={prefix + 'answer'} label="Resposta">
                  <textarea
                    id={prefix + 'answer'}
                    name="answer"
                    required
                    minLength={5}
                    maxLength={4000}
                  />
                </Field>
              )}
            </ActionForm>
          )}
        </article>
      ))}
      {requests.isSuccess && (page > 1 || requests.data.length === 25) && (
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={requests.data.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}

export function ReportReadiness({ company, actor }: { company: string; actor?: string }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const [month, setMonth] = useState('');
  const result = useQuery({
    queryKey: ['phase4-report-readiness', actor, company, month],
    queryFn:
      domainOperations && month
        ? ({ signal }) => domainOperations.reportReadiness(company, month + '-01', signal)
        : skipToken,
  });
  if (!domainOperations) return null;
  return (
    <section aria-label="Preparação do relatório" className="tw:grid tw:gap-2">
      <Field id="report-readiness-month" label="Mês para verificar preparação">
        <input
          id="report-readiness-month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.currentTarget.value)}
        />
      </Field>
      {month && result.isPending && <p role="status">Verificando o período…</p>}
      {result.isError && <p role="alert">Não foi possível consultar a preparação.</p>}
      {result.data && (
        <p>
          {result.data.mode === 'official'
            ? 'Período apto para geração oficial.'
            : result.data.mode === 'simulation'
              ? 'Já existe uma versão disponibilizada no período.'
              : `Coleta em andamento. Previsão de disponibilidade em ${formatCalendarDate(result.data.availableOn)}.`}{' '}
          {result.data.collected} de {result.data.required} dias de coleta.
        </p>
      )}
    </section>
  );
}

export function ReportAcknowledgment({ company, report }: { company: string; report: string }) {
  const { domainOperations } = useRouteContext({ from: '__root__' });
  const [protocol, setProtocol] = useState('');
  if (!domainOperations) return null;
  const operations = domainOperations;
  if (protocol) return <p role="status">Ciência registrada · {protocol}</p>;
  return (
    <ActionForm
      label="Registrar ciência do relatório"
      submit={() => operations.acknowledge(company, report)}
      saved={(result) => setProtocol(result.protocol)}
    />
  );
}
