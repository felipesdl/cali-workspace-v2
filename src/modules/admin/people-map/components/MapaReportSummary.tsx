import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { type AdminReadService } from '../../../../api/admin/workspace/admin-read';
import { Button } from '../../../../components/ds/button/Button';
import { Checkbox } from '../../../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';

import { mapaReportContent } from '../../../../lib/people-map/mapa-report-content';
import { FileDownload } from '../../../../components/documents/FileDownload';
import { ActionForm } from '../../../../components/workspace/ActionForm';

export function MapaReportSummary({
  company,
  record,
  actor,
  service,
}: {
  company: string;
  record: string;
  actor?: string;
  service: AdminReadService;
}) {
  const previewDelivery =
    import.meta.env.PROD &&
    import.meta.env.VITE_CALI_PREVIEW_MAPA_EMAIL === 'true' &&
    import.meta.env.VITE_CALI_PREVIEW_ORIGIN === window.location.origin;
  const localPilotDelivery =
    import.meta.env.DEV && import.meta.env.VITE_CALI_PHASE4_MAPA_EMAIL === 'true';
  const [open, setOpen] = useState(false);
  const report = useQuery({
    queryKey: ['phase4-mapa-report', actor, company, record],
    gcTime: 0,
    queryFn: open ? ({ signal }) => service.mapaReport(company, record, signal) : skipToken,
  });

  const data = report.isSuccess && !report.isFetching ? report.data : null;
  const content = data && mapaReportContent(data);

  return (
    <div className="tw:grid tw:gap-3">
      <div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Fechar resumo do diagnóstico' : 'Abrir resumo do diagnóstico'}
        </Button>
      </div>
      {open && report.isPending && (
        <FeedbackState kind="loading">Carregando diagnóstico…</FeedbackState>
      )}
      {open && report.isError && (
        <FeedbackState kind="error" onRetry={() => void report.refetch()}>
          Não foi possível consultar o diagnóstico.
        </FeedbackState>
      )}
      {open && report.data === null && (
        <FeedbackState kind="empty">Nenhum diagnóstico completo disponível.</FeedbackState>
      )}
      {open && data && content && (
        <div className="tw:grid tw:min-w-0 tw:gap-3 tw:wrap-anywhere">
          <p>
            Nota ponderada · <strong>{content.score}</strong>
          </p>
          <p>{content.outlook}</p>
          <ul className="tw:m-0 tw:grid tw:list-none tw:gap-3 tw:p-0 tw:wide:grid-cols-2">
            {content.dimensions.map((dimension) => (
              <li
                key={dimension.title}
                className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
              >
                <strong>{dimension.title}</strong> · {dimension.score}
                <meter
                  className="tw:block tw:w-full tw:accent-brand"
                  min={0}
                  max={10}
                  value={dimension.value}
                  aria-label={dimension.title}
                />
                {dimension.subScores.length > 0 && (
                  <ul>
                    {dimension.subScores.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                )}
                {dimension.observation && (
                  <p className="tw:whitespace-pre-wrap">{dimension.observation}</p>
                )}
              </li>
            ))}
          </ul>
          {content.opinion && (
            <section>
              <h3>Parecer CALI</h3>
              <p className="tw:whitespace-pre-wrap">{content.opinion}</p>
            </section>
          )}
          {content.recommendation && (
            <p>
              Serviço recomendado · <strong>{content.recommendation}</strong>
            </p>
          )}
          <FileDownload
            label="Baixar diagnóstico em PDF"
            download={async (signal) => {
              const current = await service.mapaReport(company, record, signal);
              if (!current) throw new Error('Diagnóstico indisponível.');
              const { mapaReportPdf } = await import('../../../../lib/people-map/mapa-report-pdf');
              return mapaReportPdf(current);
            }}
          />
          {(localPilotDelivery || previewDelivery) && (
            <ActionForm
              key={JSON.stringify(data)}
              label={
                previewDelivery
                  ? 'Enviar devolutiva de homologação'
                  : 'Enviar diagnóstico ao simulador'
              }
              dialog={{
                title: 'Deseja enviar?',
                trigger: previewDelivery
                  ? 'Enviar devolutiva de homologação'
                  : 'Enviar diagnóstico ao simulador',
              }}
              submit={async (fields, requestId) => {
                if (fields.get('confirm') !== 'on') {
                  throw new Error('Confirme o envio na segunda etapa.');
                }
                return service.emailMapaReport(data, requestId);
              }}
              success={
                previewDelivery
                  ? 'A equipe autorizada de homologação recebeu a devolutiva sintética.'
                  : 'O simulador aceitou o diagnóstico de teste.'
              }
            >
              {(prefix) => (
                <>
                  <p>
                    Tem certeza que deseja enviar esta devolutiva{' '}
                    {previewDelivery ? 'à equipe autorizada de homologação' : 'ao simulador'}?
                  </p>
                  <Checkbox id={prefix + 'confirm'} name="confirm" required>
                    Conferi o diagnóstico e confirmo o envio apenas para o destino permitido neste
                    ambiente.
                  </Checkbox>
                </>
              )}
            </ActionForm>
          )}
        </div>
      )}
    </div>
  );
}
