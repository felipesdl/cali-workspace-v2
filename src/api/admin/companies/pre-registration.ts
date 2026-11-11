import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';

export const preRegistrationFields = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(200),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  contact: z.string().trim().min(1).max(200),
  email: z.email().max(254),
});
const state = z.object({
  submittedAt: z.iso.datetime({ offset: true }).nullable(),
  releasedAt: z.iso.datetime({ offset: true }).nullable(),
  fields: preRegistrationFields.nullable(),
});
const recipient = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
});

export function createPreRegistration(client: WorkspaceClient) {
  return {
    async read(company: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pre_registration', { p_company: company })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o pré-cadastro.');
      return state.nullable().parse(data);
    },
    async issue(company: string, token: string) {
      const { error } = await client.rpc('v2_issue_pre_registration', {
        p_company: company,
        p_token: token,
      });
      if (error) throw new Error('Não foi possível gerar um link para esta empresa.');
      return token;
    },
    async submit(token: string, fields: z.input<typeof preRegistrationFields>) {
      const value = preRegistrationFields.parse(fields);
      const { error } = await client.rpc('v2_submit_pre_registration', {
        p_token: z.uuid().parse(token),
        p_name: value.name,
        p_legal_name: value.legalName,
        p_city: value.city,
        p_state: value.state,
        p_contact: value.contact,
        p_email: value.email,
      });
      if (error) throw new Error('Não foi possível enviar. Confira os dados e a validade do link.');
    },
    async release(
      company: string,
      request: string,
      signed: boolean,
      recipients: z.input<typeof recipient>[],
    ) {
      const valid = z.array(recipient).min(1).max(4).safeParse(recipients);
      if (!valid.success) throw new Error('Informe nome e e-mail válidos para cada acesso.');
      const { data, error } = await client.rpc('v2_release_pre_registration', {
        p_company: company,
        p_request: request,
        p_signed: signed,
        p_invites: valid.data,
      });
      if (error?.code === '55000')
        throw new Error('Confira o pré-cadastro, o plano e o contrato assinado na ficha.');
      if (error?.code === '23505' || error?.code === '23514')
        throw new Error('Confira as vagas e os e-mails já vinculados.');
      if (error || data !== company)
        throw new Error('Não foi possível salvar a ficha e liberar os acessos.');
    },
  };
}
export type PreRegistration = ReturnType<typeof createPreRegistration>;
