import { useState } from 'react';
import { Button } from '../../../../components/ds/button/Button';
import { FeedbackMessage } from '../../../../components/ds/feedback/FeedbackMessage';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';
import { Field } from '../../../../components/ds/field/Field';
import { Select } from '../../../../components/ds/field/Controls';
import {
  useDiscLegacyAdmin,
  useDiscLegacyEvaluationDownload,
} from '../../../../api/shared/disc/hooks';
import type { DiscStyle } from '../../../../api/shared/disc/schemas';

const styles: readonly DiscStyle[] = ['D', 'I', 'S', 'C'];
const styleNames: Record<DiscStyle, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
};
const purposes = {
  selecao: 'Seleção',
  desenvolvimento: 'Desenvolvimento',
  diagnostico: 'Diagnóstico',
} as const;

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(value))
    : '—';
}

export function LegacyDiscHistory() {
  const [linkId, setLinkId] = useState<string | null>(null);
  const query = useDiscLegacyAdmin(linkId);
  const download = useDiscLegacyEvaluationDownload();
  const selected = query.data?.selected ?? null;

  if (!query.available) return null;

  function savePdf(path: string, evaluationId: string) {
    download.mutate(path, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `cali-disc-${evaluationId}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    });
  }

  return (
    <section
      aria-label="Histórico DISC legado"
      className="tw:grid tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-5"
    >
      <header className="tw:grid tw:gap-1">
        <h2 className="tw:text-subsection tw:m-0 tw:font-semibold tw:text-brand">
          Histórico legado · leitura Admin
        </h2>
        <p className="tw:m-0 tw:max-w-3xl tw:text-caption tw:text-muted-copy">
          Catálogo V1 isolado das campanhas V2. Consulta exige sessão Admin, MFA e termos vigentes.
          Tokens públicos e links individuais não são retornados.
        </p>
      </header>

      {query.isPending ? (
        <FeedbackState kind="loading">Carregando histórico legado sintético…</FeedbackState>
      ) : query.isError ? (
        <FeedbackState kind="error" onRetry={() => void query.refetch()}>
          Catálogo legado indisponível para este acesso.
        </FeedbackState>
      ) : !query.data?.links.length ? (
        <FeedbackState kind="empty">
          Nenhuma campanha sintética autorizada no catálogo legado.
        </FeedbackState>
      ) : (
        <>
          <Field id="disc-legacy-link" label="Campanha V1">
            <Select
              id="disc-legacy-link"
              value={linkId ?? ''}
              onChange={(event) => setLinkId(event.currentTarget.value || null)}
            >
              <option value="">Selecione campanha do histórico</option>
              {query.data.links.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.title} · {link.company_name ?? 'Empresa sem rótulo'} · {link.result_count}{' '}
                  respostas
                </option>
              ))}
            </Select>
          </Field>
          <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
            Somente empresas piloto sintéticas autorizadas.
          </p>

          {selected ? (
            <div className="tw:grid tw:gap-5">
              <section className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-4">
                <h3 className="tw:m-0 tw:text-body tw:font-semibold">{selected.link.title}</h3>
                <p className="tw:m-0 tw:text-caption">
                  {selected.link.company_name ?? 'Empresa não identificada'} ·{' '}
                  {purposes[selected.link.purpose]} · criada em{' '}
                  {formatDate(selected.link.created_at)} · {selected.link.invite_count} convites ·{' '}
                  {selected.link.result_count} respostas
                </p>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  Objetivo: {selected.link.management.goal || 'não informado'} · parecer:{' '}
                  {selected.link.management.note || 'não informado'}
                </p>
              </section>

              <LegacyManagementSummary report={selected.management_report} />

              <section className="tw:grid tw:gap-3" aria-label="Relatórios individuais internos">
                <h3 className="tw:m-0 tw:text-body tw:font-semibold">
                  Relatórios individuais · uso interno CALI
                </h3>
                {selected.evaluations.length === 0 ? (
                  <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                    Sem respostas registradas.
                  </p>
                ) : (
                  <ul className="tw:m-0 tw:grid tw:gap-3 tw:p-0">
                    {selected.evaluations.map((evaluation) => (
                      <li
                        key={evaluation.id}
                        className="tw:grid tw:list-none tw:gap-3 tw:border-t tw:border-border-default tw:pt-3"
                      >
                        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
                          <div>
                            <h4 className="tw:m-0 tw:text-body tw:font-semibold">
                              {evaluation.person_name}
                            </h4>
                            <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                              {evaluation.job_title ? `${evaluation.job_title} · ` : ''}
                              {styleNames[evaluation.primary_style]} /{' '}
                              {styleNames[evaluation.secondary_style]} ·{' '}
                              {formatDate(evaluation.created_at)} ·{' '}
                              {evaluation.protocol ?? 'Sem protocolo legado'}
                            </p>
                          </div>
                          {evaluation.report_path && (
                            <Button
                              variant="secondary"
                              pending={download.isPending}
                              disabled={download.isPending}
                              onClick={() => savePdf(evaluation.report_path!, evaluation.id)}
                            >
                              Baixar PDF privado
                            </Button>
                          )}
                        </div>
                        <ScoreSummary title="Dia comum" values={evaluation.scores.natural} />
                        <ScoreSummary title="Semana difícil" values={evaluation.scores.pressure} />
                      </li>
                    ))}
                  </ul>
                )}
                {download.isError && (
                  <FeedbackMessage tone="error">
                    PDF privado indisponível. Confira a policy do bucket no projeto de homologação.
                  </FeedbackMessage>
                )}
              </section>

              <section className="tw:grid tw:gap-2" aria-label="Linha do tempo legada">
                <h3 className="tw:m-0 tw:text-body tw:font-semibold">Linha do tempo preservada</h3>
                <p className="tw:m-0 tw:text-caption tw:text-muted-copy">
                  {selected.history_completeness}
                </p>
                <ol className="tw:m-0 tw:grid tw:gap-2 tw:p-0">
                  {selected.history.map((event) => (
                    <li
                      key={`${event.kind}-${event.occurred_at}-${event.subject ?? ''}`}
                      className="tw:list-none tw:text-caption"
                    >
                      <strong>{formatDate(event.occurred_at)}</strong> · {event.summary}
                      {event.subject ? ` · ${event.subject}` : ''}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          ) : (
            <FeedbackState kind="empty">
              Selecione campanha para consultar respostas e registros preservados.
            </FeedbackState>
          )}
        </>
      )}
    </section>
  );
}

function LegacyManagementSummary({
  report,
}: {
  report: NonNullable<
    NonNullable<ReturnType<typeof useDiscLegacyAdmin>['data']>['selected']
  >['management_report'];
}) {
  if (!report) return null;
  if (report.n < 5) {
    return (
      <section className="tw:grid tw:gap-1 tw:border-t tw:border-border-default tw:pt-4">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">Relatório de gestão legado</h3>
        <p className="tw:m-0 tw:text-caption">Amostra ainda abaixo do mínimo de cinco respostas.</p>
      </section>
    );
  }
  if (report.n < 15) {
    return (
      <section className="tw:grid tw:gap-1 tw:border-t tw:border-border-default tw:pt-4">
        <h3 className="tw:m-0 tw:text-body tw:font-semibold">
          Relatório de gestão legado · faixa qualitativa
        </h3>
        <p className="tw:m-0 tw:text-caption">
          V1 armazenou dados para esta faixa. Catálogo não materializa o texto qualitativo do PDF
          legado; nenhum número ou gráfico é mostrado.
        </p>
        {report.goal && <p className="tw:m-0 tw:text-caption">Objetivo: {report.goal}</p>}
      </section>
    );
  }
  return (
    <section className="tw:grid tw:gap-2 tw:border-t tw:border-border-default tw:pt-4">
      <h3 className="tw:m-0 tw:text-body tw:font-semibold">
        Relatório de gestão legado · {report.n} respostas
      </h3>
      <p className="tw:m-0 tw:text-caption">
        Distribuição preservada do agregado V1; protocolo {report.title}.
      </p>
      {report.dist && (
        <div className="tw:grid tw:grid-cols-[repeat(4,minmax(0,1fr))] tw:gap-2">
          {styles.map((style) => (
            <p
              key={style}
              className="tw:m-0 tw:rounded-control tw:border tw:border-border-default tw:p-2 tw:text-caption"
            >
              {styleNames[style]} · predominante {report.dist?.primary[style] ?? 0} · secundário{' '}
              {report.dist?.secondary[style] ?? 0}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function ScoreSummary({
  title,
  values,
}: {
  title: string;
  values: Record<DiscStyle, { raw: number; pct: number }>;
}) {
  return (
    <div className="tw:grid tw:grid-cols-[repeat(4,minmax(0,1fr))] tw:gap-2" aria-label={title}>
      {styles.map((style) => (
        <p key={style} className="tw:m-0 tw:text-caption">
          {title} · {styleNames[style]}: {values[style].pct}%
        </p>
      ))}
    </div>
  );
}
