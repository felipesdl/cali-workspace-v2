import { getRouteApi } from '@tanstack/react-router';
import { Hours } from '../../../components/hours/HoursWorkspace';

const adminHours = getRouteApi('/admin/horas');

export function AdminHoursPage() {
  const search = adminHours.useSearch();
  const navigate = adminHours.useNavigate();
  return (
    <Hours
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change } })}
    />
  );
}
