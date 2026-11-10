import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import { companyIdentityRecordSchema } from './records';
const identityFields = 'id,display_name,legal_name,status';
// Leitor mínimo compartilhado por sessão e consulta Cliente; a autorização permanece no servidor.
export async function readHostedCompanyIdentity(
  client: WorkspaceClient,
  companyId: string,
  signal?: AbortSignal,
) {
  const id = z.uuid().parse(companyId);
  signal?.throwIfAborted();
  let query = client.from('companies').select(identityFields).eq('id', id);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error('Não foi possível consultar os dados da empresa.');
  if (!data) return null;
  const record = companyIdentityRecordSchema.parse(data);
  if (record.id !== id) throw new Error('Resposta da empresa incompatível com este acesso.');
  return record;
}
