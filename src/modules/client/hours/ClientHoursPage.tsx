import { getRouteApi } from '@tanstack/react-router';
import { Hours } from '../../../components/hours/HoursWorkspace';

const clientHours = getRouteApi('/cliente/horas');

export function ClientHoursPage() {
  const search = clientHours.useSearch();
  const navigate = clientHours.useNavigate();
  return (
    <Hours
      search={search}
      update={(change) => void navigate({ search: { ...search, ...change, companyId: undefined } })}
    />
  );
}
