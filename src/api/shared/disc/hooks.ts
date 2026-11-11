import { workspaceRole } from '../../access/schemas';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { z } from 'zod';
import { useWorkspaceSession } from '../../access/hooks/useWorkspaceSession';
import { isDiscPilotCompany } from './service';
import { discPublicCommandSchema, type DiscCommandInput, type DiscPublicCommand } from './schemas';

export function useDiscAdmin(campaignId: string | null) {
  const { disc } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const allowed = Boolean(disc && profile?.active && profile.role === workspaceRole.Admin);
  const cache = useQueryClient();
  const key = ['disc', profile?.id ?? 'unauthorized'] as const;
  const query = useQuery({
    queryKey: [...key, 'admin', campaignId],
    queryFn: allowed && disc ? ({ signal }) => disc.adminSnapshot(campaignId, signal) : skipToken,
    retry: false,
  });
  const command = useMutation({
    mutationFn: (input: DiscCommandInput) => {
      if (!allowed || !disc) throw new Error('Gestão DISC indisponível.');
      return disc.command(input);
    },
    retry: false,
    onSuccess: async () => cache.invalidateQueries({ queryKey: key }),
  });
  const processJobs = useMutation({
    mutationFn: () => {
      if (!allowed || !disc) throw new Error('Processamento de envios DISC indisponível.');
      return disc.processJobs();
    },
    retry: false,
    onSuccess: async () => cache.invalidateQueries({ queryKey: key }),
  });
  return { ...query, command, processJobs, available: allowed, actorId: profile?.id ?? null };
}

export function useDiscDownload(audience: 'admin' | 'client') {
  const { disc } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const allowed = Boolean(
    disc &&
    profile?.active &&
    profile.role === audience &&
    (audience === 'admin' || isDiscPilotCompany(profile.company_id)),
  );
  return useMutation({
    mutationFn: ({
      campaignId,
      resultId,
    }: {
      campaignId: string | null;
      resultId: string | null;
    }) => {
      if (!allowed || !disc) throw new Error('Download de relatório DISC indisponível.');
      return disc.download(campaignId, resultId);
    },
    retry: false,
  });
}

export function useDiscClient() {
  const { disc } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const allowed = Boolean(
    disc &&
    profile?.active &&
    profile.role === workspaceRole.Client &&
    isDiscPilotCompany(profile.company_id),
  );
  const query = useQuery({
    queryKey: ['disc', profile?.id ?? 'unauthorized', profile?.company_id ?? null, 'client'],
    queryFn: allowed && disc ? ({ signal }) => disc.clientSnapshot(signal) : skipToken,
    retry: false,
  });
  return { ...query, available: allowed };
}

export function useDiscLegacyAdmin(linkId: string | null) {
  const { disc } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const allowed = Boolean(disc && profile?.active && profile.role === workspaceRole.Admin);
  const query = useQuery({
    queryKey: ['disc', profile?.id ?? 'unauthorized', 'legacy-admin', linkId],
    queryFn: allowed && disc ? ({ signal }) => disc.legacyAdminSnapshot(linkId, signal) : skipToken,
    retry: false,
  });
  return { ...query, available: allowed };
}

export function useDiscLegacyEvaluationDownload() {
  const { disc } = useRouteContext({ from: '__root__' });
  const session = useWorkspaceSession();
  const profile =
    session.phase === 'resolved' && session.access.status === 'ready'
      ? session.access.profile
      : null;
  const allowed = Boolean(disc && profile?.active && profile.role === workspaceRole.Admin);
  return useMutation({
    mutationFn: (path: string) => {
      if (!allowed || !disc) throw new Error('Download legado disponível somente para Admin.');
      return disc.downloadLegacyEvaluation(path);
    },
    retry: false,
  });
}

export function useDiscPublic(token: string, legacySlug?: string) {
  const { disc } = useRouteContext({ from: '__root__' });
  const allowed = Boolean(disc && z.uuid().safeParse(token).success);
  return useQuery({
    queryKey: ['disc', 'public', legacySlug ?? null, token],
    queryFn:
      allowed && disc
        ? ({ signal }) =>
            legacySlug
              ? disc.readLegacyPublic(legacySlug, token, signal)
              : disc.readPublic(token, signal)
        : skipToken,
    retry: false,
  });
}

export function useDiscPublicCommand(token: string, legacySlug?: string) {
  const { disc } = useRouteContext({ from: '__root__' });
  const cache = useQueryClient();
  const allowed = Boolean(disc && z.uuid().safeParse(token).success);
  return useMutation({
    mutationFn: (command: DiscPublicCommand) => {
      if (!allowed || !disc) throw new Error('Link de resposta indisponível.');
      const parsed = discPublicCommandSchema.parse(command);
      return legacySlug
        ? disc.legacyPublicCommand(legacySlug, token, parsed)
        : disc.publicCommand(token, parsed);
    },
    retry: false,
    onSuccess: async () =>
      cache.invalidateQueries({ queryKey: ['disc', 'public', legacySlug ?? null, token] }),
  });
}
