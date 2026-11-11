import { z } from 'zod';
import { BANK, PRESSURE_BLOCKS, type DiscBlockAnswer } from './questionnaire';

const choice = z.enum(['D', 'I', 'S', 'C']).nullish();
const choices = z.record(z.string(), z.object({ mais: choice, menos: choice }));
const draft = z.object({
  stepIndex: z.number().int().min(0).max(28),
  consent: z.boolean(),
  person: z.object({ job: z.string().max(120) }),
  natural: choices,
  pressure: choices,
});

export function convertLegacyDiscDraft(value: string) {
  try {
    const parsed = draft.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    const { stepIndex, consent, person, natural, pressure } = parsed.data;
    const answers: Record<string, DiscBlockAnswer> = {};
    for (const [phase, blocks, stored] of [
      ['natural', BANK.map(({ block }) => block), natural],
      ['pressure', PRESSURE_BLOCKS, pressure],
    ] as const) {
      for (const block of blocks) {
        const answer = stored[String(block)];
        if (answer)
          answers[`${phase}:${block}`] = {
            b: block,
            mais: answer.mais ?? null,
            menos: answer.menos ?? null,
          };
      }
    }
    // A V1 tinha páginas de identificação e introdução antes de cada etapa.
    const currentIndex = stepIndex < 21 ? Math.max(0, stepIndex - 3) : Math.max(18, stepIndex - 4);
    return {
      started: consent && stepIndex >= 2,
      consent,
      jobTitle: person.job,
      currentIndex,
      answers,
      submission: null,
    };
  } catch {
    return null;
  }
}
