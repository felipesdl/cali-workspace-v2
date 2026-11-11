import { type SatisfactionPeriod } from '../../../../api/admin/workspace/admin-read';
import { Panel } from '../../../../components/ds/panel/Panel';

const scoreFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function SatisfactionSummary({
  value,
  accountSelected,
}: {
  value: Pick<SatisfactionPeriod, 'average' | 'total' | 'distribution' | 'trend'>;
  accountSelected: boolean;
}) {
  // Faixa de indicadores e distribuição de AdminSatisfactionPage do app.cali.
  const positive = value.distribution
    .filter(({ score }) => score >= 4)
    .reduce((sum, row) => sum + row.total, 0);
  const attention = value.distribution
    .filter(({ score }) => score <= 3)
    .reduce((sum, row) => sum + row.total, 0);
  const metrics = [
    {
      label: 'Índice de satisfação',
      value: value.average === null ? '—' : `${scoreFormat.format(value.average)}/5`,
      caption: 'Média das notas registradas',
      icon: Star,
    },
    {
      label: 'Satisfeitos',
      value: value.total ? `${Math.round((positive / value.total) * 100)}%` : '—',
      caption: `${positive} de ${value.total} com nota 4 ou 5`,
      icon: BarChart3,
    },
    {
      label: 'Base de avaliações',
      value: value.total,
      caption: accountSelected ? 'Histórico da conta' : 'Histórico da carteira',
      icon: MessageSquareText,
    },
    {
      label: 'Pedem atenção',
      value: attention,
      caption: 'Avaliações com nota de 1 a 3',
      icon: CalendarRange,
    },
  ];
  return (
    <div className="tw:grid tw:gap-4">
      <section
        aria-label="Indicadores de satisfação"
        className="tw:grid tw:grid-cols-2 tw:gap-3 tw:wide:grid-cols-4"
      >
        {metrics.map(({ label, value, caption, icon: Icon }) => (
          <Panel key={label} className="tw:grid tw:content-start tw:gap-2 tw:wrap-anywhere">
            <span className="tw:grid tw:size-8 tw:place-items-center tw:rounded-media tw:bg-ivory tw:text-brand">
              <Icon size={16} aria-hidden="true" />
            </span>
            <h2 className="tw:m-0 tw:text-caption tw:font-semibold tw:text-muted-copy">{label}</h2>
            <strong className="tw:text-section tw:text-brand">{value}</strong>
            <span className="tw:text-caption tw:text-muted-copy">{caption}</span>
          </Panel>
        ))}
      </section>
      <Panel aria-labelledby="satisfaction-summary-title" className="tw:grid tw:gap-4">
        <header>
          <p className="workspace-eyebrow tw:m-0">Distribuição</p>
          <h2 id="satisfaction-summary-title" className="tw:mt-1 tw:mb-0 tw:text-body tw:font-bold">
            Como as notas estão concentradas
          </h2>
        </header>
        {value.total > 0 ? (
          <ul
            aria-label="Distribuição das notas"
            className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0"
          >
            {[...value.distribution].reverse().map(({ score, total }) => (
              <li
                key={score}
                className="tw:grid tw:grid-cols-[3rem_minmax(0,1fr)_2rem] tw:items-center tw:gap-2 tw:text-caption"
              >
                <span>Nota {score}</span>
                <span
                  aria-hidden="true"
                  className="tw:block tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-ivory"
                >
                  <span
                    className="tw:block tw:h-full tw:rounded-full tw:bg-action-primary"
                    style={{ width: `${(total / value.total) * 100}%` }}
                  />
                </span>
                <strong className="tw:text-right">{total}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw:m-0 tw:text-muted-copy">Sem avaliações neste recorte.</p>
        )}
      </Panel>
      <Panel aria-labelledby="satisfaction-trend-title" className="tw:grid tw:gap-4">
        <header>
          <p className="workspace-eyebrow tw:m-0">Evolução</p>
          <h2 id="satisfaction-trend-title" className="tw:mt-1 tw:mb-0 tw:text-body tw:font-bold">
            Tendência das avaliações
          </h2>
        </header>
        {value.trend.length ? (
          <div className="tw:overflow-x-auto">
            <table className="tw:w-full tw:min-w-[34rem] tw:border-collapse tw:text-caption">
              <thead>
                <tr className="tw:border-b tw:border-border-default tw:text-left">
                  <th className="tw:py-2">Mês</th>
                  <th className="tw:py-2">Média</th>
                  <th className="tw:py-2">Avaliações</th>
                  <th className="tw:py-2">Notas 1–3</th>
                  <th className="tw:py-2">Notas 4–5</th>
                </tr>
              </thead>
              <tbody>
                {value.trend.map((row) => (
                  <tr key={row.month} className="tw:border-b tw:border-border-default">
                    <th className="tw:py-2 tw:text-left tw:font-medium">
                      {new Intl.DateTimeFormat('pt-BR', {
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${row.month}T12:00:00Z`))}
                    </th>
                    <td className="tw:py-2">{scoreFormat.format(row.average)}/5</td>
                    <td className="tw:py-2">{row.total}</td>
                    <td className="tw:py-2">{row.attention}</td>
                    <td className="tw:py-2">{row.positive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="tw:m-0 tw:text-muted-copy">Sem avaliações neste recorte.</p>
        )}
      </Panel>
    </div>
  );
}
import { BarChart3, CalendarRange, MessageSquareText, Star } from 'lucide-react';
