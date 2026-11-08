import { useState } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { type AdminReadService } from '../../api/modules/project-workspace/admin-read';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';

const dimensions = [
  ['Maturidade estrutural', 'Processos e políticas', 'Estrutura e papéis', 'Governança'],
  [
    'Liderança e cultura',
    'Comportamento de dono',
    'Fidelidade aos valores',
    'Desenvolvimento e sucessão',
  ],
  ['Dados e decisão', 'Indicadores', 'Decisão baseada em dados', 'Tecnologia e IA'],
  [
    'Dimensões operacionais',
    'Tamanho e complexidade',
    'Vínculos e regimes',
    'Rotatividade e custo',
  ],
] as const;
const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

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
  const [open, setOpen] = useState(false);
  const report = useQuery({
    queryKey: ['phase4-mapa-report', actor, company, record],
    gcTime: 0,
    queryFn: open ? ({ signal }) => service.mapaReport(company, record, signal) : skipToken,
  });

  const data = report.isSuccess && !report.isFetching ? report.data : null;

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
      {open && data && (
        <div className="tw:grid tw:gap-2">
          <p>
            Nota ponderada: <strong>{decimal.format(data.score)}/10</strong>
          </p>
          <ul className="tw:sm:grid-cols-2 tw:grid tw:gap-3">
            {dimensions.map(([label, ...subtitles], dimension) => (
              <li
                key={label}
                className="tw:rounded-control tw:border tw:border-border-default tw:p-3"
              >
                <strong>{label}</strong> · {decimal.format(data.dimensions[dimension])}/10
                {data.subscores && (
                  <ul>
                    {subtitles.map((subtitle, index) => {
                      const value = data.subscores?.[dimension * 3 + index];
                      return value === undefined ? null : (
                        <li key={subtitle}>
                          {subtitle}: {decimal.format(value)}/10
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
