import { type WorkspaceClient } from '../../supabase';
import {
  catalog,
  hours,
  projectDetail,
  projectList,
  type CatalogModule,
  type WorkspaceSearch,
} from './schemas';

export function createProjectWorkspace(client: WorkspaceClient) {
  return {
    async list(companyId: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_list_pilot_projects', { p_company_id: companyId, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar os projetos.');
      const result = projectList.parse(data);
      if (result.companyId !== companyId) throw new Error('Empresa divergente.');
      return result;
    },
    async detail(
      companyId: string,
      projectId: string,
      section: WorkspaceSearch['section'],
      page: number,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_read_pilot_project', {
          p_company_id: companyId,
          p_project_id: projectId,
          p_section: section,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar o projeto.');
      const result = projectDetail.nullable().parse(data);
      if (result && (result.companyId !== companyId || result.project.id !== projectId))
        throw new Error('Projeto divergente.');
      return result;
    },
    async catalog(
      companyId: string,
      module: CatalogModule,
      month: string | null,
      page: number,
      signal: AbortSignal,
    ) {
      const { data, error } = await client
        .rpc('v2_read_pilot_catalog', {
          p_company_id: companyId,
          p_module: module,
          p_month: month,
          p_page: page,
        })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar esta área.');
      const result = catalog.parse(data);
      if (result.companyId !== companyId || result.module !== module || result.month !== month)
        throw new Error('Contexto da consulta divergente.');
      return result;
    },
    async hours(companyId: string, month: string, page: number, signal: AbortSignal) {
      const { data, error } = await client
        .rpc('v2_read_pilot_hours', { p_company_id: companyId, p_month: month, p_page: page })
        .abortSignal(signal);
      if (error) throw new Error('Não foi possível consultar as horas.');
      const result = hours.parse(data);
      if (result.companyId !== companyId || result.month !== month)
        throw new Error('Período ou empresa divergente.');
      return result;
    },
  };
}

export type ProjectWorkspace = ReturnType<typeof createProjectWorkspace>;
