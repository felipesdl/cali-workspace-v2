import { z } from 'zod';

const total = z.number().int().nonnegative();
const block = z.object({
  total,
  items: z
    .array(
      z.object({
        at: z.iso.datetime({ offset: true }),
        title: z.string(),
        excerpt: z.string().nullable(),
        link: z
          .string()
          .regex(/^\/(admin|cliente)\/[A-Za-z0-9/_?&=.%:-]+$/)
          .nullable(),
      }),
    )
    .max(12),
});
export const digestJob = z.object({
  claimId: z.uuid(),
  idempotencyKey: z.string().regex(/^cali-admin-digest-test-\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}$/),
  summary: z.object({
    day: z.iso.date(),
    clientTotal: total,
    caliTotal: total,
    minutes: total,
    companies: z
      .array(
        z.object({
          name: z.string(),
          minutes: total,
          client: block,
          cali: block,
        }),
      )
      .min(1),
  }),
});
const appUrl = 'http://127.0.0.1:5173';
const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function activityLines(title: string, activity: z.infer<typeof block>) {
  if (!activity.total) return [];
  return [
    title,
    ...activity.items.map(({ at, title: label, excerpt, link }) =>
      [time.format(new Date(at)), label, excerpt, appUrl + (link ?? '/admin')]
        .filter(Boolean)
        .join(' · '),
    ),
    ...(activity.total > activity.items.length
      ? [`e mais ${activity.total - activity.items.length}`]
      : []),
  ];
}

export async function dispatchAdminDigest(
  job: z.infer<typeof digestJob> | null,
  apiKey: string,
  send: typeof fetch,
  record: (claim: string, provider: string) => Promise<boolean>,
) {
  if (job === null) return false;
  const { summary } = job;
  const day = summary.day.split('-').reverse().join('/');
  const text = [
    `Resumo do dia · ${day}`,
    `Cliente: ${summary.clientTotal} · CALI: ${summary.caliTotal} · ${summary.minutes} min`,
    ...summary.companies.flatMap((company) => [
      '',
      `${company.name} · ${company.minutes} min`,
      ...activityLines('O cliente fez', company.client),
      ...activityLines('A CALI fez', company.cali),
    ]),
  ].join('\n');
  const response = await send('https://api.resend.com/emails', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': job.idempotencyKey,
    },
    body: JSON.stringify({
      from: 'CALI Teste <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: `[TESTE] CALI Workspace · Resumo do dia · ${day}`,
      text,
    }),
  });
  if (!response.ok) throw new Error('Simulador recusou o resumo.');
  const { id } = z.object({ id: z.uuid() }).parse(await response.json());
  if (!(await record(job.claimId, id))) throw new Error('Recibo do resumo não confirmado.');
  return true;
}
