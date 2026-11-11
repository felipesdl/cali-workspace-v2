import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud } from 'lucide-react';
import { type ClientDriveService } from '../../../../api/client/drive';
import { ActionForm } from '../../../../components/workspace/ActionForm';
import { Checkbox } from '../../../../components/ds/checkbox/Checkbox';
import { FeedbackState } from '../../../../components/ds/feedback/FeedbackState';

export function ClientDrive({
  service,
  company,
  actor,
}: {
  service: ClientDriveService;
  company: string;
  actor: string;
}) {
  const cache = useQueryClient();
  const key = ['client-drive', actor, company];
  const connection = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => service.status(signal),
  });
  const files = useQuery({
    queryKey: [...key, 'files'],
    queryFn: ({ signal }) => service.files(company, signal),
    enabled: connection.data?.connected === true,
  });
  const folders = [
    ...new Set(files.data?.flatMap((file) => (file.deliverable_id ? [file.deliverable_id] : []))),
  ];
  return (
    <section
      aria-label="Cópias no Google Drive"
      className="tw:grid tw:min-w-0 tw:gap-4 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4 tw:wrap-anywhere"
    >
      <header className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-3">
        <Cloud aria-hidden="true" className="tw:shrink-0 tw:text-brand" size={23} />
        <div className="tw:min-w-0 tw:flex-1">
          <h2 className="tw:m-0 tw:text-section tw:font-semibold">Cópias no meu Google Drive</h2>
          <p className="tw:m-0 tw:mt-1 tw:text-caption tw:text-muted-copy">
            {connection.isPending
              ? 'Consultando conexão…'
              : connection.isError
                ? 'Não foi possível confirmar a conexão.'
                : connection.data?.connected
                  ? `${connection.data.connection?.accountEmail ?? 'Conta Google conectada'}. Você escolhe quais versões copiar para o Drive da empresa.`
                  : 'Conecte a conta Google da sua empresa para salvar as versões aprovadas.'}
          </p>
        </div>
        {connection.isSuccess && connection.data.connected ? (
          <ActionForm
            label="Trocar conta"
            submit={async () => {
              window.location.assign(await service.authorize());
            }}
          />
        ) : connection.isSuccess ? (
          <ActionForm
            label="Conectar Google Drive"
            submit={async () => {
              window.location.assign(await service.authorize());
            }}
          />
        ) : null}
      </header>
      <div className="tw:grid tw:min-w-0 tw:gap-4 tw:wrap-anywhere">
        {connection.isPending && <FeedbackState kind="loading">Consultando conexão…</FeedbackState>}
        {connection.isError && (
          <FeedbackState kind="error" onRetry={() => void connection.refetch()}>
            {connection.error.message}
          </FeedbackState>
        )}
        {connection.data?.connected && (
          <>
            <p className="tw:m-0">
              Copie os arquivos liberados pela CALI. A cópia fica na sua conta Google e pode
              continuar disponível após a retirada do original no Workspace.
            </p>
            {files.isError && (
              <FeedbackState kind="error" onRetry={() => void files.refetch()}>
                {files.error.message}
              </FeedbackState>
            )}
            {files.isPending && <FeedbackState kind="loading">Consultando arquivos…</FeedbackState>}
            {files.data?.length === 0 && <p>Nenhum arquivo do acervo disponível para cópia.</p>}
            {files.data?.map((file) => (
              <ActionForm
                key={file.id}
                label={`Copiar ${file.title}`}
                success="Cópia concluída no Google Drive."
                submit={() => service.copyFile(file.id)}
              />
            ))}
            {folders.map((folder) => (
              <ActionForm
                key={folder}
                label={`Copiar pasta de ${files.data?.find((file) => file.deliverable_id === folder)?.title ?? 'entregáveis'}`}
                submit={async () => {
                  const result = await service.copyFolder(folder);
                  if (result.failed)
                    throw new Error(
                      `${result.copied} arquivo(s) copiado(s), ${result.failed} pendente(s). Tente novamente para concluir a pasta.`,
                    );
                  return result;
                }}
                success="Pasta copiada para o Google Drive."
              />
            ))}
            <ActionForm
              label="Desconectar Google Drive"
              submit={async () => {
                await service.disconnect();
                await cache.invalidateQueries({ queryKey: key });
              }}
            >
              {(prefix) => (
                <Checkbox id={prefix + 'disconnect'} required>
                  Confirmo a desconexão. As cópias já feitas permanecem no meu Drive.
                </Checkbox>
              )}
            </ActionForm>
          </>
        )}
      </div>
    </section>
  );
}
