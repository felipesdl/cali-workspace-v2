import { describe, expect, it } from 'vitest';
import {
  BANK,
  hasDistinctChoices,
  orderedChoices,
  PRESSURE_BLOCKS,
  type DiscChoice,
} from '../src/modules/public/disc/components/questionnaire';

describe('DISC respondent questionnaire', () => {
  it('keeps the exact 18-block question bank', () => {
    expect(BANK.map(({ block, choices }) => [block, ...choices.map(({ text }) => text)])).toEqual([
      [
        1,
        'Decido rápido, mesmo sem tudo na mão',
        'Puxo conversa com facilidade',
        'Prefiro manter o que já funciona',
        'Confiro tudo antes de entregar',
      ],
      [
        2,
        'Assumo a frente quando trava',
        'Conto as coisas com entusiasmo',
        'Sou a pessoa que o time procura',
        'Quero entender o porquê das coisas',
      ],
      [
        3,
        'Gosto de metas difíceis',
        'Trabalho bem em grupo',
        'Prefiro rotina previsível',
        'Sigo o padrão combinado',
      ],
      [
        4,
        'Falo direto, sem rodeio',
        'Me animo com ideia nova',
        'Escuto mais do que falo',
        'Reviso o meu próprio trabalho',
      ],
      [
        5,
        'Resolvo na hora o que aparece',
        'Convenço pela conversa',
        'Mantenho a calma no aperto',
        'Prefiro ter todos os dados',
      ],
      [
        6,
        'Aceito correr risco calculado',
        'Gosto de conhecer gente nova',
        'Cumpro o que combinei',
        'Não gosto de deixar ponta solta',
      ],
      [
        7,
        'Fico impaciente com processo lento',
        'Falo em público sem dificuldade',
        'Ajudo sem que me peçam',
        'Anoto tudo para não esquecer',
      ],
      [
        8,
        'Prefiro decidir a esperar',
        'Meu humor contamina o ambiente',
        'Evito criar atrito',
        'Questiono quando não faz sentido',
      ],
      [
        9,
        'Gosto de ter a palavra final',
        'Faço amizade rápido',
        'Prefiro trabalhar com quem já conheço',
        'Trabalho melhor sozinho e concentrado',
      ],
      [
        10,
        'Busco resultado antes de tudo',
        'Prefiro tarefa que envolve gente',
        'Não gosto de mudança de última hora',
        'Detecto erro com facilidade',
      ],
      [
        11,
        'Delego sem dificuldade',
        'Gosto de reconhecimento na frente do time',
        'Prefiro instrução clara e estável',
        'Preciso de tempo para pensar',
      ],
      [
        12,
        'Encaro conflito de frente',
        'Puxo o time para cima',
        'Escuto antes de discordar',
        'Prefiro qualidade a velocidade',
      ],
      [
        13,
        'Aumento o ritmo quando aperta',
        'Falo o que penso na hora',
        'Prefiro o combinado ao improviso',
        'Organizo antes de começar',
      ],
      [
        14,
        'Me incomoda gente que enrola',
        'Gosto de ambiente animado',
        'Sou leal a quem está comigo',
        'Me cobro mais do que os outros me cobram',
      ],
      [
        15,
        'Prefiro pedir desculpa a pedir licença',
        'Me distraio em tarefa repetitiva',
        'Sou o ponto de equilíbrio do grupo',
        'Sigo a regra mesmo sem supervisão',
      ],
      [
        16,
        'Assumo risco sem consultar',
        'Converso com todo mundo',
        'Prefiro trabalhar em ritmo constante',
        'Quero que fique certo, não rápido',
      ],
      [
        17,
        'Me irrito com quem não decide',
        'Me empolgo com o que é novo',
        'Prefiro ambiente sem clima pesado',
        'Me incomoda resposta vaga',
      ],
      [
        18,
        'Gosto de ser cobrado por resultado',
        'Me aborreço com trabalho solitário',
        'Prefiro estabilidade a mudança',
        'Necessito de critério claro para agir',
      ],
    ]);
  });

  it('repeats only the six approved blocks under the difficult-week prompt', () => {
    expect(PRESSURE_BLOCKS).toEqual([2, 5, 8, 11, 14, 17]);
    expect(BANK).toHaveLength(18);
    expect(BANK.every(({ choices }) => choices.length === 4)).toBe(true);
    expect(BANK.every(({ choices }) => new Set(choices.map(({ id }) => id)).size === 4)).toBe(true);
    expect(PRESSURE_BLOCKS.map((block) => BANK[block - 1]?.block)).toEqual([2, 5, 8, 11, 14, 17]);
  });

  it('preserves reference option order for natural and repeated blocks', () => {
    const expected: Record<number, DiscChoice[]> = {
      2: ['I', 'S', 'D', 'C'],
      5: ['I', 'D', 'S', 'C'],
      8: ['D', 'C', 'I', 'S'],
      11: ['I', 'C', 'S', 'D'],
      14: ['I', 'S', 'D', 'C'],
      17: ['I', 'D', 'S', 'C'],
    };

    for (const block of PRESSURE_BLOCKS) {
      expect(orderedChoices(BANK[block - 1]!, true).map(({ id }) => id)).toEqual(expected[block]);
    }
    expect(orderedChoices(BANK[0]!, false).map(({ id }) => id)).toEqual(['I', 'S', 'D', 'C']);
  });

  it('accepts complete MAIS/MENOS pairs only when choices differ', () => {
    expect(hasDistinctChoices({ b: 1, mais: 'D', menos: 'I' })).toBe(true);
    expect(hasDistinctChoices({ b: 1, mais: 'D', menos: 'D' })).toBe(false);
    expect(hasDistinctChoices({ b: 1, mais: 'D', menos: null })).toBe(false);
    expect(hasDistinctChoices({ b: 1, mais: null, menos: 'I' })).toBe(false);
    expect(hasDistinctChoices(undefined)).toBe(false);
  });
});
