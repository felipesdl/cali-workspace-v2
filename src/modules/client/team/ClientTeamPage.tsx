import { getRouteApi } from '@tanstack/react-router';
import { TeamPage } from '../../../components/team/TeamPage';

const clientRoute = getRouteApi('/cliente/equipe');

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
