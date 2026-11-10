import { type MonthlyState } from '../../api/shared/team/monthly';
import { type MonthlyReviewState } from '../../api/shared/team/monthly-review';
import { monthlyIndicators } from './monthly-indicators';
import { formatCalendarDate } from '../../lib/dates';

export function TeamMonthlyIndicators({
  data,
  review,
}: {
  data: MonthlyState;
  review: MonthlyReviewState;
}) {
  const values = monthlyIndicators(data.metrics, review.summary);
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const items = [
    ['Quadro ativo', values.active, ''],
    ['Admissões', values.admissions, ''],
    ['Desligamentos', values.exits, ''],
    ['Variação líquida', values.net, ''],
    ['Rotatividade', values.turnover, '%'],
    ['Movimentações internas', values.moves, ''],
    ['Absenteísmo', values.absenteeism, '%'],
  ] as const;
  return (
    <section
      aria-label="Indicadores essenciais"
      className="tw:grid tw:min-w-0 tw:gap-4 tw:border-t tw:border-border-default tw:pt-4"
    >
      <h3 className="tw:m-0 tw:text-section tw:font-bold">Indicadores essenciais</h3>
      {!review.summary && (
        <p className="tw:text-caption tw:text-muted-copy">
          O quadro e as movimentações aparecem após a confirmação do mês.
        </p>
      )}
      <dl className="tw:m-0 tw:grid tw:grid-cols-3 tw:gap-4 tw:mobile:grid-cols-1">
        {items.map(([label, value, unit]) => (
          <div key={label}>
            <dt className="tw:text-caption tw:text-muted-copy">{label}</dt>
            <dd className="tw:m-0 tw:font-semibold">
              {value === null ? 'Não informado' : `${number.format(value)}${unit}`}
            </dd>
          </div>
        ))}
      </dl>
      <p className="tw:text-caption tw:text-muted-copy">
        Entradas e saídas seguem a data efetiva. Absenteísmo considera as ausências divididas pelas
        horas previstas. A rotatividade segue saídas sobre o quadro ativo da referência.
      </p>
      <h4 className="tw:m-0 tw:text-body">Evolução em até 12 referências</h4>
      <p className="tw:text-caption tw:text-muted-copy">
        Na referência atual, o resumo desconsidera fichas arquivadas. As admissões e saídas da série
        conservam os registros históricos.
      </p>
      {review.series.length === 0 ? (
        <p>Nenhuma referência confirmada neste intervalo.</p>
      ) : (
        <div
          role="region"
          aria-label="Evolução mensal da equipe"
          tabIndex={0}
          className="tw:min-w-0 tw:overflow-x-auto"
        >
          <table className="tw:w-full tw:border-collapse tw:text-left tw:text-caption tw:[&_:is(th,td)]:border-b tw:[&_:is(th,td)]:border-border-default tw:[&_:is(th,td)]:p-3">
            <caption className="tw:pb-3 tw:text-left">
              Somente meses confirmados até {data.referenceMonth.slice(0, 7)}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Referência</th>
                <th scope="col">Quadro ativo</th>
                <th scope="col">Admissões</th>
                <th scope="col">Desligamentos</th>
                <th scope="col">Mudanças internas</th>
              </tr>
            </thead>
            <tbody>
              {review.series.map((point) => (
                <tr key={point.reference_month}>
                  <th scope="row">{formatCalendarDate(point.reference_month).slice(3)}</th>
                  <td>{point.active}</td>
                  <td>{point.admissions}</td>
                  <td>{point.exits}</td>
                  <td>{point.moves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
