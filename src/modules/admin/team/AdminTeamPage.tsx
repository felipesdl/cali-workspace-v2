import { getRouteApi } from '@tanstack/react-router';
import { TeamPage } from '../../../components/team/TeamPage';

const adminRoute = getRouteApi('/admin/equipe');

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
