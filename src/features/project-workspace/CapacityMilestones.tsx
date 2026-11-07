import { type HourCapacityHistory } from '../../api/modules/project-workspace/schemas';
import { formatServerInstant } from '../../lib/dates';

const labels: Record<HourCapacityHistory['milestones'][number]['kind'], string> = {
  m75: 'Atenção ao consumo',
  m100: 'Capacidade integralmente utilizada',
  excess: 'Capacidade ultrapassada',
  tolerance: 'Limite de tolerância atingido',
  review: 'Avaliar adequação da capacidade',
};
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function CapacityMilestones({ history }: { history: HourCapacityHistory }) {
  return (
    <section
      className="tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
      aria-label="Marcos de capacidade"
    >
      <h2 className="tw:font-semibold">Marcos de capacidade</h2>
      {history.paused && <p role="status">Atividades em pausa neste mês.</p>}
      {history.milestones.length ? (
        <ul className="tw:mt-2 tw:grid tw:gap-2">
          {history.milestones.map(({ kind, percent: recorded, at, occurrence }) => (
            <li key={kind}>
              <strong>{labels[kind]}</strong>
              <p>
                {percent.format(recorded)}% registrados em {formatServerInstant(at)}
                {occurrence && ` · Ocorrência ${occurrence}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum marco registrado neste mês.</p>
      )}
    </section>
  );
}
