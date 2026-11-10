export type DiscChoice = 'D' | 'I' | 'S' | 'C';

export type DiscQuestion = {
  block: number;
  choices: readonly { id: DiscChoice; text: string }[];
};

export type DiscBlockAnswer = {
  b: number;
  mais: DiscChoice | null;
  menos: DiscChoice | null;
};

export const BANK = [
  {
    block: 1,
    choices: [
      { id: 'D', text: 'Decido rápido, mesmo sem tudo na mão' },
      { id: 'I', text: 'Puxo conversa com facilidade' },
      { id: 'S', text: 'Prefiro manter o que já funciona' },
      { id: 'C', text: 'Confiro tudo antes de entregar' },
    ],
  },
  {
    block: 2,
    choices: [
      { id: 'D', text: 'Assumo a frente quando trava' },
      { id: 'I', text: 'Conto as coisas com entusiasmo' },
      { id: 'S', text: 'Sou a pessoa que o time procura' },
      { id: 'C', text: 'Quero entender o porquê das coisas' },
    ],
  },
  {
    block: 3,
    choices: [
      { id: 'D', text: 'Gosto de metas difíceis' },
      { id: 'I', text: 'Trabalho bem em grupo' },
      { id: 'S', text: 'Prefiro rotina previsível' },
      { id: 'C', text: 'Sigo o padrão combinado' },
    ],
  },
  {
    block: 4,
    choices: [
      { id: 'D', text: 'Falo direto, sem rodeio' },
      { id: 'I', text: 'Me animo com ideia nova' },
      { id: 'S', text: 'Escuto mais do que falo' },
      { id: 'C', text: 'Reviso o meu próprio trabalho' },
    ],
  },
  {
    block: 5,
    choices: [
      { id: 'D', text: 'Resolvo na hora o que aparece' },
      { id: 'I', text: 'Convenço pela conversa' },
      { id: 'S', text: 'Mantenho a calma no aperto' },
      { id: 'C', text: 'Prefiro ter todos os dados' },
    ],
  },
  {
    block: 6,
    choices: [
      { id: 'D', text: 'Aceito correr risco calculado' },
      { id: 'I', text: 'Gosto de conhecer gente nova' },
      { id: 'S', text: 'Cumpro o que combinei' },
      { id: 'C', text: 'Não gosto de deixar ponta solta' },
    ],
  },
  {
    block: 7,
    choices: [
      { id: 'D', text: 'Fico impaciente com processo lento' },
      { id: 'I', text: 'Falo em público sem dificuldade' },
      { id: 'S', text: 'Ajudo sem que me peçam' },
      { id: 'C', text: 'Anoto tudo para não esquecer' },
    ],
  },
  {
    block: 8,
    choices: [
      { id: 'D', text: 'Prefiro decidir a esperar' },
      { id: 'I', text: 'Meu humor contamina o ambiente' },
      { id: 'S', text: 'Evito criar atrito' },
      { id: 'C', text: 'Questiono quando não faz sentido' },
    ],
  },
  {
    block: 9,
    choices: [
      { id: 'D', text: 'Gosto de ter a palavra final' },
      { id: 'I', text: 'Faço amizade rápido' },
      { id: 'S', text: 'Prefiro trabalhar com quem já conheço' },
      { id: 'C', text: 'Trabalho melhor sozinho e concentrado' },
    ],
  },
  {
    block: 10,
    choices: [
      { id: 'D', text: 'Busco resultado antes de tudo' },
      { id: 'I', text: 'Prefiro tarefa que envolve gente' },
      { id: 'S', text: 'Não gosto de mudança de última hora' },
      { id: 'C', text: 'Detecto erro com facilidade' },
    ],
  },
  {
    block: 11,
    choices: [
      { id: 'D', text: 'Delego sem dificuldade' },
      { id: 'I', text: 'Gosto de reconhecimento na frente do time' },
      { id: 'S', text: 'Prefiro instrução clara e estável' },
      { id: 'C', text: 'Preciso de tempo para pensar' },
    ],
  },
  {
    block: 12,
    choices: [
      { id: 'D', text: 'Encaro conflito de frente' },
      { id: 'I', text: 'Puxo o time para cima' },
      { id: 'S', text: 'Escuto antes de discordar' },
      { id: 'C', text: 'Prefiro qualidade a velocidade' },
    ],
  },
  {
    block: 13,
    choices: [
      { id: 'D', text: 'Aumento o ritmo quando aperta' },
      { id: 'I', text: 'Falo o que penso na hora' },
      { id: 'S', text: 'Prefiro o combinado ao improviso' },
      { id: 'C', text: 'Organizo antes de começar' },
    ],
  },
  {
    block: 14,
    choices: [
      { id: 'D', text: 'Me incomoda gente que enrola' },
      { id: 'I', text: 'Gosto de ambiente animado' },
      { id: 'S', text: 'Sou leal a quem está comigo' },
      { id: 'C', text: 'Me cobro mais do que os outros me cobram' },
    ],
  },
  {
    block: 15,
    choices: [
      { id: 'D', text: 'Prefiro pedir desculpa a pedir licença' },
      { id: 'I', text: 'Me distraio em tarefa repetitiva' },
      { id: 'S', text: 'Sou o ponto de equilíbrio do grupo' },
      { id: 'C', text: 'Sigo a regra mesmo sem supervisão' },
    ],
  },
  {
    block: 16,
    choices: [
      { id: 'D', text: 'Assumo risco sem consultar' },
      { id: 'I', text: 'Converso com todo mundo' },
      { id: 'S', text: 'Prefiro trabalhar em ritmo constante' },
      { id: 'C', text: 'Quero que fique certo, não rápido' },
    ],
  },
  {
    block: 17,
    choices: [
      { id: 'D', text: 'Me irrito com quem não decide' },
      { id: 'I', text: 'Me empolgo com o que é novo' },
      { id: 'S', text: 'Prefiro ambiente sem clima pesado' },
      { id: 'C', text: 'Me incomoda resposta vaga' },
    ],
  },
  {
    block: 18,
    choices: [
      { id: 'D', text: 'Gosto de ser cobrado por resultado' },
      { id: 'I', text: 'Me aborreço com trabalho solitário' },
      { id: 'S', text: 'Prefiro estabilidade a mudança' },
      { id: 'C', text: 'Necessito de critério claro para agir' },
    ],
  },
] as const satisfies readonly DiscQuestion[];

export const PRESSURE_BLOCKS = [2, 5, 8, 11, 14, 17] as const;

// Ordem visual original por bloco, sem carregar cálculo ou classificação para o navegador.
const OPTION_ORDER = [
  ['I', 'S', 'D', 'C'],
  ['S', 'I', 'C', 'D'],
  ['D', 'S', 'I', 'C'],
  ['I', 'D', 'S', 'C'],
  ['S', 'D', 'C', 'I'],
  ['S', 'C', 'I', 'D'],
  ['D', 'C', 'I', 'S'],
  ['C', 'D', 'S', 'I'],
  ['C', 'S', 'D', 'I'],
  ['I', 'C', 'S', 'D'],
  ['D', 'I', 'C', 'S'],
  ['C', 'I', 'D', 'S'],
  ['I', 'S', 'D', 'C'],
  ['S', 'I', 'C', 'D'],
  ['D', 'S', 'I', 'C'],
  ['I', 'D', 'S', 'C'],
  ['S', 'D', 'C', 'I'],
  ['S', 'C', 'I', 'D'],
] as const satisfies readonly (readonly DiscChoice[])[];

const PRESSURE_ORDER: readonly (readonly DiscChoice[])[] = [
  ['I', 'S', 'D', 'C'],
  ['I', 'D', 'S', 'C'],
  ['D', 'C', 'I', 'S'],
  ['I', 'C', 'S', 'D'],
  ['I', 'S', 'D', 'C'],
  ['I', 'D', 'S', 'C'],
];

export function orderedChoices(question: DiscQuestion, pressure: boolean) {
  const order = pressure
    ? PRESSURE_ORDER[PRESSURE_BLOCKS.findIndex((block) => block === question.block)]
    : OPTION_ORDER[question.block - 1];
  if (!order) return question.choices;
  return order.flatMap((id) => question.choices.filter((choice) => choice.id === id));
}

export function hasDistinctChoices(
  answer: DiscBlockAnswer | undefined,
): answer is DiscBlockAnswer & { mais: DiscChoice; menos: DiscChoice } {
  return Boolean(answer?.mais && answer.menos && answer.mais !== answer.menos);
}
