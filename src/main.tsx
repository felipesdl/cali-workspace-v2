import React from 'react';
import { createRoot } from 'react-dom/client';
import { readEnvironment } from './config/environment';
import { App } from './app/App';
import { createAppRouter } from './app/router';
import { createSessionController } from './app/session/controller';
import { createQueryClient } from './api/query-client';
import { createWorkspaceClient } from './api/supabase';
import { createHostedAccessApi } from './api/modules/access/api';
import { composeCompaniesService } from './api/modules/companies/api';
import './styles/tokens.css';
import './styles/tailwind.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento raiz da aplicação não encontrado.');
const root = createRoot(rootElement);

try {
  const environment = readEnvironment(import.meta.env);
  const cache = createQueryClient();
  const client =
    environment.mode === 'supabase'
      ? createWorkspaceClient(environment.url, environment.publishableKey)
      : null;
  const access =
    client && environment.mode === 'supabase'
      ? createHostedAccessApi(client, environment.url, environment.publishableKey)
      : null;
  const session = access ? createSessionController(access, cache) : null;
  const router = createAppRouter(
    undefined,
    cache,
    session,
    access ? { access, companies: composeCompaniesService(client) } : undefined,
  );
  root.render(
    <React.StrictMode>
      <App router={router} />
    </React.StrictMode>,
  );
} catch {
  root.render(
    <main role="alert" className="tw:p-6">
      <h1>Configuração indisponível</h1>
      <p>Revise a configuração de dados, URL e chave pública do ambiente.</p>
    </main>,
  );
}
