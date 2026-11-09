import { teamHistory, teamStructure } from './history';
import { importPrivateRow, teamImportPreview, type ImportPrivateRow } from './import';
import { type ProfessionalPatch } from './maintenance';
import {
  teamPrivateRecord,
  teamPrivateValues,
  type TeamPrivateRecord,
  type TeamPrivateValues,
} from './private-fields';
import { z } from 'zod';
import { teamSaveResult, teamSaveRowSchema, type TeamSaveRow } from './maintenance';
import { type WorkspaceClient } from '../../supabase';
import { professionalRecord, teamDirectory, type TeamSearch } from './schemas';

export function createHostedTeam(client: WorkspaceClient) {
  return {
    async previewImport(companyId: string, fields: ProfessionalPatch[]) {
      const { data, error } = await client.rpc('v2_preview_pilot_team_import', {
        p_company_id: companyId,
        p_fields: fields,
      });
      if (error) throw new Error('Não foi possível preparar a prévia da equipe.');
      return teamImportPreview.parse(data);
    },
    async confirmImport(
      companyId: string,
      month: string,
      rows: TeamSaveRow[],
      privateRows: ImportPrivateRow[],
    ) {
      const { data, error } = await client.rpc('v2_confirm_pilot_team_import', {
        p_company_id: companyId,
        p_month: month,
        p_rows: z.array(teamSaveRowSchema).min(1).max(2000).parse(rows),
        p_private_rows: z.array(importPrivateRow).max(2000).parse(privateRows),
      });
      if (error?.code === '40001' || error?.code === '23505')
        throw new Error('A equipe mudou. Atualize a prévia antes de confirmar.');
      if (error?.code === '22023') throw new Error(error.message);
      if (error) throw new Error('Não foi possível confirmar a importação.');
      return teamSaveResult.parse(data);
    },
    async history(
      companyId: string,
      month: string,
      memberId: string | undefined,
      page: number,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_read_pilot_team_history', {
          p_company_id: companyId,
          p_month: month,
          p_member_id: memberId ?? null,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar o histórico.');
      return teamHistory.parse(data);
    },
    async structure(companyId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_team_structure', {
          p_company_id: companyId,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar a estrutura.');
      return teamStructure.parse(data);
    },
    async readPrivate(companyId: string, memberId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_team_private', {
          p_company_id: companyId,
          p_member_id: memberId,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar os dados privados.');
      const record = teamPrivateRecord.nullable().parse(data);
      if (record && (record.company_id !== companyId || record.member_id !== memberId))
        throw new Error('Ficha privada fora da empresa recusada.');
      return record;
    },
    async writePrivate(record: TeamPrivateRecord, values: TeamPrivateValues, declared: boolean) {
      const { data, error } = await client.rpc('v2_write_pilot_team_private', {
        p_company_id: record.company_id,
        p_member_id: record.member_id,
        p_expected_at: record.updated_at,
        p_declared: declared,
        p_fields: teamPrivateValues.parse(values),
      });
      if (error?.code === '40001')
        throw new Error('Dados privados alterados. Recarregue antes de salvar.');
      if (error?.code === '22023') throw new Error(error.message);
      if (error || data !== record.member_id)
        throw new Error('Não foi possível confirmar os dados privados.');
    },
    async save(companyId: string, month: string, rows: TeamSaveRow[]) {
      const { data, error } = await client.rpc('v2_save_pilot_team', {
        p_company_id: companyId,
        p_month: month,
        p_rows: z.array(teamSaveRowSchema).min(1).max(2000).parse(rows),
      });
      if (error?.code === '40001' || error?.code === '23505')
        throw new Error('Uma ficha mudou. Recarregue os dados e revise antes de salvar.');
      if (error?.code === '22023') throw new Error(error.message);
      if (error) throw new Error('Não foi possível salvar a equipe.');
      return teamSaveResult.parse(data);
    },
    async archive(companyId: string, memberId: string, month: string, expectedAt: string) {
      const { data, error } = await client.rpc('v2_archive_pilot_team_member', {
        p_company_id: companyId,
        p_member_id: memberId,
        p_month: month,
        p_expected_at: expectedAt,
      });
      if (error?.code === '40001') throw new Error('Ficha mudou. Recarregue antes de arquivar.');
      if (error || data !== memberId) throw new Error('Não foi possível confirmar o arquivamento.');
    },
    async list(
      companyId: string,
      filters: Pick<TeamSearch, 'q' | 'status' | 'page'>,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_list_pilot_team', {
          p_company_id: companyId,
          p_query: filters.q,
          p_status: filters.status,
          p_page: filters.page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar o diretório.');
      const directory = teamDirectory.parse(data);
      if (directory.companyId !== companyId)
        throw new Error('Diretório de outra empresa recusado.');
      return directory;
    },
    async member(companyId: string, memberId: string, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_team_member', {
          p_company_id: companyId,
          p_member_id: memberId,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível carregar a ficha.');
      const member = professionalRecord.nullable().parse(data);
      if (member && (member.company_id !== companyId || member.id !== memberId))
        throw new Error('Ficha fora da empresa recusada.');
      return member;
    },
  };
}
export type TeamService = ReturnType<typeof createHostedTeam>;
