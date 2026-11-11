import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicFormQuestion } from '../workspace/domain-operations';
import { encodeAttachment } from '../workspace/file-payload';

const legacyQuestion = publicFormQuestion.extend({
  id: z.string().min(1).max(100),
  required: z.boolean().default(false),
  help: z.string().optional(),
  logic: z.array(z.object({ when: z.string(), goTo: z.string() })).optional(),
});
const resolvedForm = z
  .object({
    source: z.enum(['pilot', 'legacy']),
    formId: z.uuid(),
    slug: z.string().min(3).max(100),
    category: z.string().nullable().optional(),
    status: z.enum(['open', 'closed']),
    title: z.string(),
    description: z.string().nullable(),
    questions: z.array(legacyQuestion).max(100),
    thankYou: z.string().nullable().optional(),
    successText: z.string().nullable().optional(),
    submitLabel: z.string().nullable().optional(),
    confirmationEnabled: z.boolean(),
  })
  .superRefine((form, context) => {
    if (form.status === 'open' && form.questions.length === 0) {
      context.addIssue({ code: 'custom', message: 'Formulário aberto precisa ter perguntas.' });
    }
  });
const resolution = z.discriminatedUnion('source', [
  resolvedForm,
  z.object({ source: z.literal('unavailable') }),
]);
export type PublicForm = z.infer<typeof resolvedForm>;
type Answers = Record<string, string | number | string[] | File>;
type SubmitResult = { ok: true; confirmation: boolean; thank_you?: string | null };

function rpcFailure(code?: string) {
  if (code === '40001')
    return new Error(
      'Esta tentativa já foi registrada com outras respostas. Atualize a página para conferir antes de enviar de novo.',
    );
  if (code === 'P0002')
    return new Error('A origem do formulário mudou. Recarregue antes de continuar.');
  if (code === '42501') return new Error('Este formulário não está recebendo respostas.');
  if (code === 'PGRST202')
    return new Error('A resolução segura da origem do formulário ainda não está instalada.');
  if (code === '22023') return new Error('Confira as respostas do formulário.');
  return new Error('Não foi possível confirmar o envio. Tente novamente com esta mesma tentativa.');
}

export function createPublicForms(url: string, key: string) {
  const client = createClient(url, key, {
    auth: {
      storageKey: 'cali-public-forms',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const uploaded = new WeakMap<File, string>();
  const pending = new Map<string, Promise<SubmitResult>>();
  return {
    async read(slug: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_resolve_public_form', { p_slug: slug })
        .abortSignal(signal);
      if (error) throw rpcFailure(error.code);
      const result = resolution.nullable().parse(data);
      return !result || result.source === 'unavailable' ? null : result;
    },
    submit(form: PublicForm, request: string, answers: Answers, visited: string[]) {
      const key = `${form.formId}:${request}`;
      const existing = pending.get(key);
      if (existing) return existing;
      const submission = (async () => {
        const encoded: Record<string, string | number | string[]> = { __visited: visited };
        for (const [id, answer] of Object.entries(answers)) {
          if (!(answer instanceof File)) {
            encoded[id] = answer;
            continue;
          }
          const question = form.questions.find((item) => item.id === id);
          if (!question || question.kind !== 'file' || answer.size === 0) {
            throw new Error('Confira o arquivo selecionado.');
          }
          if (form.source === 'pilot') {
            if (answer.size > 2 * 1024 * 1024 || !answer.name.toLowerCase().endsWith('.pdf')) {
              throw new Error('Selecione um PDF de até 2 MiB.');
            }
            encoded[id] = await encodeAttachment(answer);
            continue;
          }
          if (answer.size > 25 * 1024 * 1024) throw new Error('Envie um arquivo de até 25 MiB.');
          if (
            question.accept === 'images_pdf' &&
            !['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
              answer.type,
            )
          ) {
            throw new Error('Envie PDF ou imagem neste campo.');
          }
          let path = uploaded.get(answer);
          if (!path) {
            const digest = new Uint8Array(
              await crypto.subtle.digest('SHA-256', await answer.arrayBuffer()),
            );
            const fingerprint = Array.from(digest, (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('');
            const name =
              answer.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .slice(-80) || 'arquivo';
            path = `${form.formId}/${request}/${id}-${fingerprint}-${name}`;
            const { error } = await client.storage
              .from('cali-forms')
              .upload(path, answer, { contentType: answer.type || undefined, upsert: false });
            if (error && error.statusCode !== '409')
              throw new Error(
                'Não foi possível enviar o anexo. Tente novamente com esta mesma tentativa.',
              );
            uploaded.set(answer, path);
          }
          encoded[id] = path;
        }
        const { data, error } = await client.rpc('v2_submit_resolved_public_form', {
          p_slug: form.slug,
          p_form_id: form.formId,
          p_origin: form.source,
          p_request_id: request,
          p_answers: encoded,
        });
        if (error) throw rpcFailure(error.code);
        return z
          .object({
            ok: z.literal(true),
            confirmation: z.boolean(),
            thank_you: z.string().nullable().optional(),
          })
          .parse(data);
      })();
      pending.set(key, submission);
      void submission
        .finally(() => {
          if (pending.get(key) === submission) pending.delete(key);
        })
        .catch(() => undefined);
      return submission;
    },
  };
}
export type PublicFormsService = ReturnType<typeof createPublicForms>;
