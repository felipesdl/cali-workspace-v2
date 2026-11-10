import { useNavigate, useSearch } from '@tanstack/react-router';
import { AdminDiscPage } from './components/AdminDiscPage';

export function AdminDiscRoute() {
  const search = useSearch({ from: '/admin/perfil' });
  const navigate = useNavigate({ from: '/admin/perfil' });
  return (
    <AdminDiscPage
      campaignId={search.campaign ?? null}
      onCampaignChange={(campaign) =>
        void navigate({ search: { campaign: campaign ?? undefined } })
      }
    />
  );
}
