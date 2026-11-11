import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import {
  discAdminSnapshotSchema,
  discClientSnapshotSchema,
  discCommandResultSchema,
  discCommandSchema,
  discLegacyAdminSnapshotSchema,
  DISC_PILOT_COMPANY_IDS,
  discProcessJobsResultSchema,
  discPublicCommandSchema,
  discPublicProjectionSchema,
  type DiscAdminSnapshot,
  type DiscClientSnapshot,
  type DiscCommandInput,
  type DiscLegacyAdminSnapshot,
  type DiscPublicCommand,
  type DiscPublicProjection,
} from './schemas';

export function isDiscPilotCompany(companyId: string | null | undefined) {
  return (
    companyId !== null &&
    companyId !== undefined &&
    DISC_PILOT_COMPANY_IDS.some((id) => id === companyId)
  );
}

const unavailable = () =>
  new Error('Operação DISC indisponível. Atualize a página e tente novamente.');
const conflicted = () =>
  new Error('O DISC mudou desde a última leitura. Recarregue antes de continuar.');
const publicKinds = ['open', 'progress', 'decline', 'submit'] as const;
const commandError = (error: { code?: string; message?: string }) => {
  if (error.code === '40001') return conflicted();
  if (error.code === '22023' && error.message?.trim() && error.message.length <= 300) {
    return new Error(error.message);
  }
  return unavailable();
};

export interface DiscService {
  adminSnapshot(campaignId: string | null, signal: AbortSignal): Promise<DiscAdminSnapshot>;
  clientSnapshot(signal: AbortSignal): Promise<DiscClientSnapshot>;
  command(input: DiscCommandInput): Promise<{ id: string; revision: number }>;
  processJobs(): Promise<{ processed: number; failed: number }>;
  download(campaignId: string | null, resultId: string | null): Promise<Blob>;
  readPublic(token: string, signal: AbortSignal): Promise<DiscPublicProjection>;
  publicCommand(token: string, command: DiscPublicCommand): Promise<DiscPublicProjection>;
  readLegacyPublic(slug: string, token: string, signal: AbortSignal): Promise<DiscPublicProjection>;
  legacyPublicCommand(
    slug: string,
    token: string,
    command: DiscPublicCommand,
  ): Promise<DiscPublicProjection>;
  legacyAdminSnapshot(linkId: string | null, signal: AbortSignal): Promise<DiscLegacyAdminSnapshot>;
  downloadLegacyEvaluation(path: string): Promise<Blob>;
}

export function createHostedDisc(client: WorkspaceClient): DiscService {
  return {
    async adminSnapshot(campaignId, signal) {
      const parsedId = campaignId === null ? null : z.uuid().parse(campaignId);
      const { data, error } = await client
        .rpc('v2_disc_admin', { p_campaign: parsedId })
        .abortSignal(signal);
      if (error) throw unavailable();
      const result = discAdminSnapshotSchema.parse(data);
      const campaigns = result.campaigns.filter(
        (campaign) => campaign.company_id === null || isDiscPilotCompany(campaign.company_id),
      );
      const selected =
        result.selected &&
        (result.selected.campaign.company_id === null ||
          isDiscPilotCompany(result.selected.campaign.company_id))
          ? result.selected
          : null;
      if (parsedId && selected?.campaign.id !== parsedId) throw unavailable();
      return { campaigns, selected };
    },

    async clientSnapshot(signal) {
      const { data, error } = await client.rpc('v2_disc_client', {}).abortSignal(signal);
      if (error) throw unavailable();
      const result = discClientSnapshotSchema.parse(data);
      return {
        reports: result.reports.filter(
          (report) => report.released_at !== null && report.mode !== 'unavailable',
        ),
      };
    },

    async command(input) {
      const { campaignId, expected, requestId, ...rawCommand } = input;
      const command = discCommandSchema.parse(rawCommand);
      const campaign = command.kind === 'create' ? null : z.uuid().parse(campaignId);
      const revision =
        command.kind === 'create' ? null : z.number().int().nonnegative().parse(expected);
      const request = z.uuid().parse(requestId);
      if (
        command.kind === 'create' &&
        command.fields.companyId !== null &&
        !isDiscPilotCompany(command.fields.companyId)
      ) {
        throw new Error('Empresa fora do escopo sintético autorizado.');
      }
      const { data, error } = await client.rpc('v2_disc_command', {
        p_campaign: campaign,
        p_expected: revision,
        p_request: request,
        p_kind: command.kind,
        p_fields: command.fields,
      });
      if (error) throw commandError(error);
      const result = discCommandResultSchema.parse(data);
      if (campaign && result.id !== campaign) throw unavailable();
      return result;
    },

    async processJobs() {
      const { data, error } = await client.functions.invoke('workspace-disc-pilot', { body: {} });
      if (error) throw new Error('Não foi possível processar os envios DISC de teste.');
      return discProcessJobsResultSchema.parse(data);
    },

    async download(campaignId, resultId) {
      const selectedCampaign = campaignId === null ? null : z.uuid().parse(campaignId);
      const selectedResult = resultId === null ? null : z.uuid().parse(resultId);
      if (selectedCampaign === null && selectedResult === null) throw unavailable();
      const { data, error } = await client.functions.invoke('workspace-disc-pilot', {
        body: { action: 'document', campaignId: selectedCampaign, resultId: selectedResult },
      });
      if (
        error ||
        !(data instanceof Blob) ||
        data.type.toLowerCase() !== 'application/pdf' ||
        data.size === 0 ||
        data.size > 15 * 1024 * 1024
      ) {
        throw new Error('Não foi possível carregar o PDF autorizado.');
      }
      return data;
    },

    async readPublic(token, signal) {
      const parsedToken = z.uuid().parse(token);
      const { data, error } = await client
        .rpc('v2_disc_public', { p_token: parsedToken, p_kind: 'read', p_fields: {} })
        .abortSignal(signal);
      if (error) throw unavailable();
      return discPublicProjectionSchema.parse(data);
    },

    async publicCommand(token, input) {
      const parsedToken = z.uuid().parse(token);
      const command = discPublicCommandSchema.parse(input);
      if (!publicKinds.some((kind) => kind === command.kind)) throw unavailable();
      const { data, error } = await client.rpc('v2_disc_public', {
        p_token: parsedToken,
        p_kind: command.kind,
        p_fields: command.fields,
      });
      if (error) throw unavailable();
      return discPublicProjectionSchema.parse(data);
    },

    async readLegacyPublic(slug, token, signal) {
      const parsedSlug = z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .parse(slug);
      const parsedToken = z.uuid().parse(token);
      const { data, error } = await client
        .rpc('v2_disc_legacy_public', {
          p_slug: parsedSlug,
          p_token: parsedToken,
          p_kind: 'read',
          p_fields: {},
        })
        .abortSignal(signal);
      if (error) throw unavailable();
      return discPublicProjectionSchema.parse(data);
    },

    async legacyPublicCommand(slug, token, input) {
      const parsedSlug = z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .parse(slug);
      const parsedToken = z.uuid().parse(token);
      const command = discPublicCommandSchema.parse(input);
      const { data, error } = await client.rpc('v2_disc_legacy_public', {
        p_slug: parsedSlug,
        p_token: parsedToken,
        p_kind: command.kind,
        p_fields: command.fields,
      });
      if (error) throw commandError(error);
      return discPublicProjectionSchema.parse(data);
    },

    async legacyAdminSnapshot(linkId, signal) {
      const parsedLink = linkId === null ? null : z.uuid().parse(linkId);
      const { data, error } = await client
        .rpc('v2_disc_legacy_admin', { p_link: parsedLink })
        .abortSignal(signal);
      if (error) throw unavailable();
      return discLegacyAdminSnapshotSchema.parse(data);
    },

    async downloadLegacyEvaluation(path) {
      const parsedPath = z
        .string()
        .max(300)
        .regex(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9._-]+\.pdf$/i,
        )
        .parse(path);
      const { data, error } = await client.storage.from('cali-profiles').download(parsedPath);
      if (
        error ||
        data.type.toLowerCase() !== 'application/pdf' ||
        data.size === 0 ||
        data.size > 15 * 1024 * 1024
      ) {
        throw new Error('PDF legado indisponível para este acesso Admin.');
      }
      return data;
    },
  };
}
