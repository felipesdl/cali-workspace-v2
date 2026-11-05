import { TeamImport } from './TeamImport';
import { HistoryFilters, TeamHistory, TeamStructure } from './TeamHistory';
import { useState } from 'react';
import { TeamCreate, TeamMaintenance } from './TeamMaintenance';
import { type TeamSaveRow } from '../../api/modules/team/maintenance';
import { ClientModulePending } from '../client-account/ClientModulePending';
import { getRouteApi } from '@tanstack/react-router';
import { isPilotCompany } from '../../api/modules/companies/onboarding';
import { useCompaniesQuery } from '../../api/modules/companies/hooks/useCompaniesQuery';
import { teamSearchSchema, teamViews, type TeamSearch } from '../../api/modules/team/schemas';
import { useTeam } from '../../api/modules/team/useTeam';
import { Button } from '../../components/ds/button/Button';
import { FeedbackState } from '../../components/ds/feedback/FeedbackState';
import { Field } from '../../components/ds/field/Field';
import { TeamDirectory } from './TeamDirectory';
import { teamStatusLabels } from './presentation';

const clientRoute = getRouteApi('/cliente/equipe');
const adminRoute = getRouteApi('/admin/equipe');
const panel = 'tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4';

function CompanySelect({
  search,
  navigate,
}: {
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const companies = useCompaniesQuery({ q: '', status: 'all' });
  if (companies.isPending)
    return <FeedbackState kind="loading">Carregando empresas…</FeedbackState>;
  if (companies.isError)
    return (
      <FeedbackState kind="error" onRetry={() => void companies.refetch()}>
        Não foi possível carregar as empresas.
      </FeedbackState>
    );
  return (
    <Field id="team-company" label="Empresa de homologação">
      <select
        id="team-company"
        value={search.companyId ?? ''}
        onChange={(event) =>
          navigate({
            companyId: event.currentTarget.value || undefined,
            page: 1,
            member: undefined,
          })
        }
      >
        <option value="">Selecione a empresa</option>
        {companies.data
          .filter((company) => isPilotCompany(company.id))
          .map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
      </select>
    </Field>
  );
}

function DirectoryFilters({
  search,
  navigate,
}: {
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  return (
    <form
      aria-label="Filtrar equipe"
      className="tw:sm:grid-cols-[1fr_1fr_auto] tw:mb-4 tw:grid tw:items-end tw:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const { q, status } = teamSearchSchema.parse({
          q: data.get('q'),
          status: data.get('status'),
        });
        navigate({ q, status, page: 1, member: undefined });
      }}
    >
      <Field id="team-search" label="Buscar por nome, cargo, área ou código">
        <input id="team-search" name="q" type="search" defaultValue={search.q} maxLength={120} />
      </Field>
      <Field id="team-status" label="Situação">
        <select id="team-status" name="status" defaultValue={search.status}>
          {Object.entries(teamStatusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="secondary">
        Aplicar filtros
      </Button>
    </form>
  );
}

function TeamToolbar({
  search,
  navigate,
}: {
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const views = {
    [teamViews.Directory]: 'Diretório',
    [teamViews.Structure]: 'Estrutura',
    [teamViews.History]: 'Histórico',
  } as const;
  return (
    <nav aria-label="Seções de Equipe" className="tw:flex tw:flex-wrap tw:gap-2">
      {Object.values(teamViews).map((view) => (
        <Button
          key={view}
          variant={search.view === view ? 'primary' : 'secondary'}
          aria-current={search.view === view ? 'page' : undefined}
          onClick={() => navigate({ view, page: 1, member: undefined })}
        >
          {views[view]}
        </Button>
      ))}
    </nav>
  );
}

function DirectoryActions({
  team,
  save,
  announce,
}: {
  team: ReturnType<typeof useTeam>;
  save: (month: string, row: TeamSaveRow) => Promise<void>;
  announce: (message: string) => void;
}) {
  const [importing, setImporting] = useState(false);
  return importing ? (
    <TeamImport
      pending={team.importTeam.isPending}
      onPreview={(fields) => team.preview.mutateAsync(fields)}
      onCancel={() => setImporting(false)}
      onConfirm={async (month, rows, privateRows) => {
        const result = await team.importTeam.mutateAsync({ month, rows, privateRows });
        announce(
          `Importação concluída. ${result.ids.length} ${result.ids.length === 1 ? 'ficha conferida' : 'fichas conferidas'} e ${result.added} ${result.added === 1 ? 'nova' : 'novas'}.`,
        );
        setImporting(false);
      }}
    />
  ) : (
    <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-3">
      <TeamCreate onSave={save} pending={team.save.isPending} />
      <Button variant="secondary" disabled={team.save.isPending} onClick={() => setImporting(true)}>
        Importar CSV
      </Button>
    </div>
  );
}

function TeamSupportingView({
  team,
  search,
  navigate,
}: {
  team: ReturnType<typeof useTeam>;
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  if (search.view === teamViews.Structure) {
    return (
      <section className={panel} aria-label="Estrutura da equipe">
        <h2 className="tw:mb-3 tw:text-section tw:font-bold tw:text-brand">Estrutura</h2>
        {team.structure.isPending && (
          <FeedbackState kind="loading">Carregando estrutura…</FeedbackState>
        )}
        {team.structure.isError && (
          <FeedbackState kind="error" onRetry={() => void team.structure.refetch()}>
            Não foi possível carregar a estrutura.
          </FeedbackState>
        )}
        {team.structure.data && <TeamStructure rows={team.structure.data} />}
      </section>
    );
  }
  return (
    <section className={panel} aria-label="Histórico da equipe">
      <h2 className="tw:mb-3 tw:text-section tw:font-bold tw:text-brand">Histórico</h2>
      <HistoryFilters month={team.month} member={search.member} navigate={navigate} />
      {team.history.isPending && (
        <FeedbackState kind="loading">Carregando histórico…</FeedbackState>
      )}
      {team.history.isError && (
        <FeedbackState kind="error" onRetry={() => void team.history.refetch()}>
          Não foi possível carregar o histórico.
        </FeedbackState>
      )}
      {team.history.data && (
        <TeamHistory history={team.history.data} page={search.page} navigate={navigate} />
      )}
    </section>
  );
}

function TeamPage({
  admin,
  search,
  navigate,
}: {
  admin: boolean;
  search: TeamSearch;
  navigate: (update: Partial<TeamSearch>) => void;
}) {
  const team = useTeam(search);
  const [confirmation, setConfirmation] = useState<{ companyId: string; message: string }>();
  function announce(message: string) {
    if (team.companyId) setConfirmation({ companyId: team.companyId, message });
  }
  async function save(month: string, row: TeamSaveRow) {
    await team.save.mutateAsync({ month, rows: [row] });
    announce('Ficha profissional salva.');
  }
  if (!team.available) return admin ? null : <ClientModulePending />;
  return (
    <div className="tw:grid tw:gap-4">
      {confirmation && confirmation.companyId === team.companyId && team.enabled && (
        <p role="status" className="tw:text-brand">
          {confirmation.message}
        </p>
      )}
      {admin && (
        <div className={panel}>
          <CompanySelect search={search} navigate={navigate} />
        </div>
      )}
      {team.enabled && <TeamToolbar search={search} navigate={navigate} />}
      {!team.enabled ? (
        <FeedbackState kind="empty">
          {admin
            ? 'Selecione uma empresa de homologação para consultar a equipe.'
            : 'O diretório de Equipe ainda está em homologação.'}
        </FeedbackState>
      ) : search.view !== teamViews.Directory ? (
        <TeamSupportingView team={team} search={search} navigate={navigate} />
      ) : (
        <section className={panel} aria-labelledby="team-directory-title">
          <h2
            id="team-directory-title"
            className="tw:mb-2 tw:text-section tw:font-bold tw:text-brand"
          >
            Diretório
          </h2>
          {team.list.data && (
            <p className="tw:mb-4 tw:text-muted-copy">{team.list.data.companyName}</p>
          )}
          {team.list.isSuccess && (
            <div className="tw:mb-4">
              <DirectoryActions key={team.companyId} team={team} save={save} announce={announce} />
            </div>
          )}
          <DirectoryFilters
            key={`${team.companyId}:${search.q}:${search.status}`}
            search={search}
            navigate={navigate}
          />
          {team.list.isPending && (
            <FeedbackState kind="loading">Carregando diretório…</FeedbackState>
          )}
          {team.list.isError && (
            <FeedbackState kind="error" onRetry={() => void team.list.refetch()}>
              Não foi possível carregar o diretório.
            </FeedbackState>
          )}
          {team.list.data && team.list.data.total === 0 && (
            <FeedbackState kind="empty">Nenhuma pessoa encontrada com estes filtros.</FeedbackState>
          )}
          {team.list.data && team.list.data.total > 0 && (
            <TeamDirectory directory={team.list.data} page={search.page} navigate={navigate} />
          )}
        </section>
      )}
      {team.enabled && search.view === teamViews.Directory && search.member && (
        <section className={panel} aria-label="Ficha profissional">
          {team.member.isPending && <FeedbackState kind="loading">Carregando ficha…</FeedbackState>}
          {team.member.isError && (
            <FeedbackState kind="error" onRetry={() => void team.member.refetch()}>
              Não foi possível carregar a ficha.
            </FeedbackState>
          )}
          {team.member.isSuccess && !team.member.data && (
            <FeedbackState kind="empty">Ficha indisponível nesta empresa.</FeedbackState>
          )}
          {team.member.data && (
            <TeamMaintenance
              key={team.member.data.id}
              member={team.member.data}
              saving={team.save.isPending}
              archiving={team.archive.isPending}
              onSave={save}
              onArchive={async (month, record) => {
                await team.archive.mutateAsync({ month, record });
                announce('Ficha arquivada. O histórico foi preservado.');
              }}
            />
          )}
          <div className="tw:mt-4 tw:flex tw:flex-wrap tw:gap-3">
            {team.member.data && (
              <Button
                variant="secondary"
                onClick={() => navigate({ view: teamViews.History, page: 1 })}
              >
                Ver histórico da ficha
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate({ member: undefined })}>
              Fechar ficha
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export function ClientTeamPage() {
  const search = clientRoute.useSearch();
  const navigate = clientRoute.useNavigate();
  return (
    <TeamPage
      admin={false}
      search={search}
      navigate={(update) =>
        void navigate({ search: { ...search, ...update, companyId: undefined } })
      }
    />
  );
}

export function AdminTeamPage() {
  const search = adminRoute.useSearch();
  const navigate = adminRoute.useNavigate();
  return (
    <TeamPage
      admin
      search={search}
      navigate={(update) => void navigate({ search: { ...search, ...update } })}
    />
  );
}
