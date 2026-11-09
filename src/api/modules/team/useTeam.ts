import { workspaceRole } from '../access/schemas';
import { type ImportPrivateRow } from './import';
import { writeMonthOptions, type ProfessionalPatch } from './maintenance';
import { teamViews } from './schemas';
import { type TeamSaveRow } from './maintenance';
import { type ProfessionalRecord } from './schemas';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../companies/onboarding';
import { type TeamSearch } from './schemas';

export function useTeam(search: TeamSearch) {
  const { team } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const companyId = profile?.role === workspaceRole.Admin ? search.companyId : profile?.company_id;
  const enabled = Boolean(team && profile?.active && companyId && isPilotCompany(companyId));
  const cache = useQueryClient();
  const key = ['team', profile?.id, companyId] as const;
  const list = useQuery({
    queryKey: [...key, 'directory', search.q, search.status, search.page],
    queryFn:
      enabled && team && companyId && search.view === teamViews.Directory
        ? ({ signal }) => team.list(companyId, search, signal)
        : skipToken,
  });
  const memberId = search.member;
  const month = `${search.month ?? writeMonthOptions()[0]}-01`;
  const history = useQuery({
    queryKey: [...key, 'history', month, memberId, search.page],
    queryFn:
      enabled && team && companyId && search.view === teamViews.History
        ? ({ signal }) => team.history(companyId, month, memberId, search.page, signal)
        : skipToken,
  });
  const structure = useQuery({
    queryKey: [...key, 'structure'],
    queryFn:
      enabled && team && companyId && search.view === teamViews.Structure
        ? ({ signal }) => team.structure(companyId, signal)
        : skipToken,
  });
  const member = useQuery({
    queryKey: [...key, 'member', memberId],
    queryFn:
      enabled && team && companyId && memberId && search.view === teamViews.Directory
        ? ({ signal }) => team.member(companyId, memberId, signal)
        : skipToken,
  });
  const save = useMutation({
    mutationFn: ({ month, rows }: { month: string; rows: TeamSaveRow[] }) => {
      if (!enabled || !team || !companyId) throw new Error('Equipe indisponível.');
      return team.save(companyId, month, rows);
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  });
  const archive = useMutation({
    mutationFn: ({ month, record }: { month: string; record: ProfessionalRecord }) => {
      if (!enabled || !team || !companyId || record.company_id !== companyId)
        throw new Error('Equipe indisponível.');
      return team.archive(companyId, record.id, month, record.updated_at);
    },
    retry: false,
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  });
  const preview = useMutation({
    mutationFn: (fields: ProfessionalPatch[]) => {
      if (!enabled || !team || !companyId) throw new Error('Equipe indisponível.');
      return team.previewImport(companyId, fields);
    },
    retry: false,
    gcTime: 0,
  });
  const importTeam = useMutation({
    mutationFn: ({
      month,
      rows,
      privateRows,
    }: {
      month: string;
      rows: TeamSaveRow[];
      privateRows: ImportPrivateRow[];
    }) => {
      if (!enabled || !team || !companyId) throw new Error('Equipe indisponível.');
      return team.confirmImport(companyId, month, rows, privateRows);
    },
    retry: false,
    gcTime: 0,
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  });
  return {
    list,
    member,
    history,
    structure,
    month,
    save,
    archive,
    preview,
    importTeam,
    companyId,
    enabled,
    available: Boolean(team),
  };
}
