import { type MapaReport } from '../../api/admin/workspace/admin-read';

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
const score = (value: number) => decimal.format(value) + '/10';

export function mapaReportContent(report: MapaReport) {
  const [first, ...others] = dimensions.map(([title, ...labels], index) => ({
    title,
    value: report.dimensions[index],
    observation: report.observations?.[index],
    subScores: labels.flatMap((label, position) => {
      const value = report.subscores?.[index * 3 + position];
      return value === undefined ? [] : [label + ' · ' + score(value)];
    }),
  }));
  const strength = others.reduce(
    (selected, dimension) => (dimension.value > selected.value ? dimension : selected),
    first,
  );
  const priority = others.reduce(
    (selected, dimension) => (dimension.value < selected.value ? dimension : selected),
    first,
  );
  const outlook =
    strength.value === priority.value
      ? 'As quatro dimensões têm a mesma pontuação.'
      : `${strength.title} tem a maior pontuação (${score(strength.value)}). ${priority.title} pede atenção primeiro (${score(priority.value)}).`;
  return {
    score: score(report.score),
    outlook,
    dimensions: [first, ...others].map((dimension) => ({
      ...dimension,
      score: score(dimension.value),
    })),
    opinion: report.opinion,
    recommendation: report.recommendedService,
  };
}
