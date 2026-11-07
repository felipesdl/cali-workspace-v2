import { useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { Button } from '../../components/ds/button/Button';
import { Field } from '../../components/ds/field/Field';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { formatCalendarDate, formatServerInstant } from '../../lib/dates';
import { companyStatusLabels } from '../companies/presentation';
import { ActionForm } from './ActionForm';

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
    </section>
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
