import { getRouteApi } from '@tanstack/react-router';
import { Projects } from '../../../components/projects/ProjectsWorkspace';

const clientProjects = getRouteApi('/cliente/entregaveis');

export function ClientProjectsPage() {
  const search = clientProjects.useSearch();
  const navigate = clientProjects.useNavigate();
  return (
    <Projects
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change, companyId: undefined } })}
    />
  );
}
