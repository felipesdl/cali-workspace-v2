import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

const options = z.object({
  confirmEmail: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
});
const trashItem = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: z.enum(['form', 'responses']),
  deletedAt: z.iso.datetime({ offset: true }),
  responseCount: z.number().int().nonnegative(),
});
function failure(code?: string) {
  if (code === '40001') return new Error('O formulário mudou. Recarregue antes de continuar.');
  if (code === '42501') return new Error('Operação indisponível para esta sessão.');
  if (code === 'PGRST202')
    return new Error('Gestão da lixeira ainda não instalada neste ambiente.');
  return new Error('Não foi possível concluir a operação do formulário.');
}
export function createFormLifecycle(client: WorkspaceClient) {
  return {
    async options(company: string, form: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_form_options', { p_company: company, p_form: form })
        .abortSignal(signal);
      if (error) throw failure(error.code);
      return options.parse(data);
    },
    async configure(company: string, form: string, expected: string, confirmEmail: boolean) {
      const { error } = await client.rpc('v2_set_form_confirmation', {
        p_company: company,
        p_form: form,
        p_expected: expected,
        p_enabled: confirmEmail,
      });
      if (error) throw failure(error.code);
      return form;
    },
    async trash(company: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_form_trash', { p_company: company, p_page: page })
        .abortSignal(signal);
      if (error) throw failure(error.code);
      return z.array(trashItem).parse(data);
    },
    async remove(company: string, form: string, expected: string, title: string) {
      const { data, error } = await client.rpc('v2_trash_form', {
        p_company: company,
        p_form: form,
        p_expected: expected,
        p_title: title,
      });
      if (error) throw failure(error.code);
      return z.uuid().parse(data);
    },
    async removeResponse(company: string, form: string, response: string) {
      const { data, error } = await client.rpc('v2_trash_form_response', {
        p_company: company,
        p_form: form,
        p_response: response,
      });
      if (error) throw failure(error.code);
      return z.uuid().parse(data);
    },
    async restore(company: string, entry: string) {
      const { data, error } = await client.rpc('v2_restore_form', {
        p_company: company,
        p_entry: entry,
      });
      if (error) throw failure(error.code);
      return z.uuid().parse(data);
    },
  };
}
export type FormLifecycle = ReturnType<typeof createFormLifecycle>;
