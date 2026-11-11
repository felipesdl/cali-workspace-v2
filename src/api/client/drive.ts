import { z } from 'zod';
import { type WorkspaceClient } from '../supabase';

const driveUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['drive.google.com', 'docs.google.com'].includes(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.port
  );
});
const status = z.object({
  connected: z.boolean(),
  connection: z
    .object({
      id: z.uuid(),
      accountEmail: z.email(),
      rootFolderName: z.string().nullable(),
      status: z.string(),
    })
    .nullable(),
  jobs: z.array(
    z.object({
      file_id: z.uuid(),
      status: z.string(),
      external_url: driveUrl.nullable(),
      updated_at: z.string(),
    }),
  ),
});
const sourceFile = z.object({
  id: z.uuid(),
  title: z.string(),
  deliveryId: z.uuid().nullable(),
  deliveryTitle: z.string().nullable(),
  source: z.enum(['legacy', 'document']),
});

export function isDriveCallbackState(state: string) {
  const [payload, signature, trailing] = state.split('.');
  if (!payload || !signature || trailing !== undefined) return false;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return z.object({ purpose: z.literal('drive') }).safeParse(JSON.parse(decoded)).success;
  } catch {
    return false;
  }
}

export function createClientDrive(client: WorkspaceClient) {
  let exchange: { state: string; code: string; promise: Promise<void> } | null = null;
  async function call(body: object, signal?: AbortSignal) {
    const { data, error } = await client.functions.invoke('google-drive-oauth', { body, signal });
    if (error)
      throw new Error(
        'Não foi possível concluir a operação no Drive. Confira sua conexão e tente novamente.',
      );
    return data;
  }
  return {
    async status(signal: AbortSignal) {
      return status.parse(await call({ action: 'status' }, signal));
    },
    async files(page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_drive_sources', { p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os arquivos disponíveis para cópia.');
      return z.array(sourceFile).parse(data);
    },
    async authorize() {
      const { url } = z.object({ url: z.url() }).parse(await call({ action: 'authorize' }));
      const destination = new URL(url);
      if (
        destination.origin !== 'https://accounts.google.com' ||
        destination.username ||
        destination.password
      )
        throw new Error('Destino de autorização inválido.');
      return url;
    },
    exchange(code: string, state: string) {
      if (exchange?.code === code && exchange.state === state) return exchange.promise;
      const promise = call({ action: 'exchange', code, state }).then((data) => {
        z.object({ ok: z.literal(true), purpose: z.literal('drive') }).parse(data);
      });
      exchange = { code, state, promise };
      return promise;
    },
    async copyFile(file: string, source: z.infer<typeof sourceFile>['source']) {
      return z
        .object({ status: z.literal('synced'), url: driveUrl })
        .parse(await call({ action: 'copy_file', fileId: file, source }));
    },
    async copyFolder(folder: string) {
      return z
        .object({
          status: z.enum(['synced', 'partial']),
          url: driveUrl,
          copied: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
        })
        .parse(await call({ action: 'copy_folder', deliverableId: folder }));
    },
    async disconnect() {
      z.object({ ok: z.literal(true) }).parse(await call({ action: 'disconnect' }));
    },
  };
}
export type ClientDriveService = ReturnType<typeof createClientDrive>;
