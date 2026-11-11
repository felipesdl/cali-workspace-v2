import { createClientDrive } from './api/client/drive';
import { createPublicForms } from './api/shared/forms/public';
import { createFormLifecycle } from './api/admin/forms/lifecycle';
import { createAdminPortfolio } from './api/admin/workspace/admin-portfolio';
import { createNotificationsService } from './api/shared/notifications/service';
import { createOwnProfileService } from './api/access/own-profile';
import { createPartnerOtpQa, createPartnerPilot } from './api/partner/pilot';
import { createProjectJournal } from './api/shared/workspace/project-journal';
import { createAdminRead } from './api/admin/workspace/admin-read';
import { createDocumentOperations } from './api/shared/workspace/documents';
import { createAgendaOperations } from './api/shared/workspace/agenda';
import { createDomainOperations } from './api/shared/workspace/domain-operations';
import { createHourOperations, createProjectOperations } from './api/shared/workspace/operations';
import { createProjectWorkspace } from './api/shared/workspace/service';
import { createHostedDisc } from './api/shared/disc/service';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { readEnvironment, resolveCaliRuntime } from './config/environment';
import { App } from './app/App';
import { createAppRouter } from './app/router';
import { createSessionController } from './app/session/controller';
import { createQueryClient } from './api/query-client';
import { createWorkspaceClient } from './api/supabase';
import { createHostedAccessApi } from './api/access/api';
import { createHostedTeam } from './api/shared/team/hosted';
import { createHostedTeamMonthly } from './api/shared/team/monthly';
import { composeCompaniesService } from './api/admin/companies/api';
import './styles/tokens.css';
import './styles/tailwind.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento raiz da aplicação não encontrado.');
const root = createRoot(rootElement);

try {
  const environment = readEnvironment(import.meta.env);
  const runtime = resolveCaliRuntime(environment, import.meta.env.DEV, window.location.origin);
  if (environment.mode === 'supabase' && environment.previewOrigin && !runtime.preview)
    throw new Error('Abra a URL configurada para este preview de homologação.');
  const cache = createQueryClient();
  const client =
    environment.mode === 'supabase'
      ? createWorkspaceClient(environment.url, environment.publishableKey)
      : null;
  const access =
    client && environment.mode === 'supabase'
      ? createHostedAccessApi(
          client,
          environment.url,
          environment.publishableKey,
          runtime.pilot &&
            import.meta.env.VITE_CALI_PILOT_ACCESS === 'true' &&
            window.location.hostname === '127.0.0.1' &&
            ['5181', '5182'].includes(window.location.port)
            ? 'workspace-access-pilot'
            : 'workspace-access',
        )
      : null;
  const session = access ? createSessionController(access, cache) : null;
  const team = client && runtime.pilot ? createHostedTeam(client) : null;
  const accountOperations = Boolean(team) || runtime.releaseCore;
  const phase4 =
    (runtime.pilot || runtime.preview) && client && import.meta.env.VITE_CALI_PHASE4_READ === 'true'
      ? client
      : null;
  const phase4Write = import.meta.env.VITE_CALI_PHASE4_WRITE === 'true' ? phase4 : null;
  const reportRelease = Boolean(
    phase4Write && import.meta.env.VITE_CALI_PHASE4_REPORT_RELEASE === 'true',
  );
  const domainOperations = phase4Write ? createDomainOperations(phase4Write) : null;
  const router = createAppRouter(
    undefined,
    cache,
    session,
    access
      ? {
          access,
          companies: composeCompaniesService(client),
          ownProfile: client ? createOwnProfileService(client, accountOperations) : null,
          notifications: accountOperations && client ? createNotificationsService(client) : null,
          partnerPilot:
            team &&
            client &&
            window.location.hostname === '127.0.0.1' &&
            import.meta.env.VITE_CALI_PHASE5_PARTNER === 'true'
              ? createPartnerPilot(
                  client,
                  window.location.port === '5183' && import.meta.env.VITE_CALI_PARTNER_OTP_QA_TICKET
                    ? createPartnerOtpQa(client, import.meta.env.VITE_CALI_PARTNER_OTP_QA_TICKET)
                    : undefined,
                )
              : null,
          team,
          monthly: team && client ? createHostedTeamMonthly(client) : null,
          disc: client && (runtime.pilot || runtime.preview) ? createHostedDisc(client) : null,
          projectWorkspace: phase4 ? createProjectWorkspace(phase4, reportRelease) : null,
          adminPortfolio:
            client && (phase4 || runtime.releaseCore) ? createAdminPortfolio(client) : null,
          projectJournal: phase4 ? createProjectJournal(phase4, Boolean(phase4Write)) : null,
          projectOperations: phase4Write ? createProjectOperations(phase4Write) : null,
          hourOperations: phase4Write ? createHourOperations(phase4Write) : null,
          domainOperations,
          clientDrive: phase4Write ? createClientDrive(phase4Write) : null,
          formLifecycle:
            client && (accountOperations || (runtime.preview && phase4Write))
              ? createFormLifecycle(client)
              : null,
          publicForms:
            environment.mode === 'supabase'
              ? createPublicForms(environment.url, environment.publishableKey)
              : null,
          documentOperations: phase4Write ? createDocumentOperations(phase4Write) : null,
          agendaOperations: phase4Write
            ? createAgendaOperations(
                phase4Write,
                runtime.preview && import.meta.env.VITE_CALI_GOOGLE_CALENDAR_SYNC === 'true',
              )
            : null,
          adminRead:
            phase4 && import.meta.env.VITE_CALI_PHASE4_ADMIN_READ === 'true'
              ? createAdminRead(phase4)
              : null,
        }
      : undefined,
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
      <p>Revise a URL, a chave pública e a origem configurada para este ambiente.</p>
    </main>,
  );
}
