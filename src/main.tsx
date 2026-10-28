import React from 'react';
import { createRoot } from 'react-dom/client';
import { readEnvironment } from './config/environment';
import { App } from './app/App';
import { createAppRouter } from './app/router';
import './styles/tokens.css';
import './styles/tailwind.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento raiz da aplicação não encontrado.');
const root = createRoot(rootElement);

try {
  readEnvironment({
    VITE_DATA_MODE: import.meta.env.VITE_DATA_MODE,
    VITE_DEMO_MODE: import.meta.env.VITE_DEMO_MODE,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  });
  const router = createAppRouter();
  root.render(
    <React.StrictMode>
      <App router={router} />
    </React.StrictMode>,
  );
} catch {
  root.render(
    <main role="alert" style={{ padding: 24 }}>
      <h1>Configuração indisponível</h1>
      <p>
        Esta etapa aceita somente dados demonstrativos locais. Revise a configuração do ambiente.
      </p>
    </main>,
  );
}
