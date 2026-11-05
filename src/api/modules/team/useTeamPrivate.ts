import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { useWorkspaceSession } from '../access/hooks/useWorkspaceSession';
import { isPilotCompany } from '../companies/onboarding';
import { type ProfessionalRecord } from './schemas';
import { type TeamPrivateRecord, type TeamPrivateValues } from './private-fields';

export function useTeamPrivate(member: ProfessionalRecord) {
  const { team } = useRouteContext({ from: '__root__' });
  const state = useWorkspaceSession();
  const profile =
    state.phase === 'resolved' && state.access.status === 'ready' ? state.access.profile : null;
  const enabled = Boolean(
    profile?.active &&
    isPilotCompany(member.company_id) &&
    (profile.role === 'admin' ||
      (profile.role === 'client' && profile.company_id === member.company_id)),
  );
  const cache = useQueryClient();
  const rootKey = ['team', profile?.id, member.company_id] as const;
  const query = useQuery({
    queryKey: [...rootKey, 'private', member.id],
    queryFn:
      enabled && team
        ? ({ signal }) => team.readPrivate(member.company_id, member.id, signal)
        : skipToken,
    gcTime: 0,
  });
  const save = useMutation({
    mutationFn: ({
      record,
      values,
      declared,
    }: {
      record: TeamPrivateRecord;
      values: TeamPrivateValues;
      declared: boolean;
    }) => {
      if (
        !enabled ||
        !team ||
        record.company_id !== member.company_id ||
        record.member_id !== member.id
      )
        throw new Error('Ficha privada indisponível.');
      return team.writePrivate(record, values, declared);
    },
    retry: false,
    gcTime: 0,
    onSuccess: () => cache.invalidateQueries({ queryKey: rootKey }),
  });
  return { query, save, enabled };
}
