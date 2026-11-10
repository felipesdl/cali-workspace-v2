import { getRouteApi } from '@tanstack/react-router';
import { Projects } from '../../../components/projects/ProjectsWorkspace';

const adminProjects = getRouteApi('/admin/projetos');

export function AdminProjectsPage() {
  const search = adminProjects.useSearch();
  const navigate = adminProjects.useNavigate();
  return (
    <Projects
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
