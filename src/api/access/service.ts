import { z } from 'zod';
import { workspaceAccessStateSchema, type CurrentTerms } from './session';
import { workspaceRole, type WorkspaceProfileRecord } from './schemas';
import { type CompanyIdentityRecord } from '../admin/companies/records';

export type AccessPorts = {
  identity: () => Promise<{ id: string } | null>;
  profile: (id: string, signal: AbortSignal) => Promise<WorkspaceProfileRecord | null>;
  company: (id: string, signal: AbortSignal) => Promise<CompanyIdentityRecord | null>;
  adminMfaReady: () => Promise<boolean>;
  termsState: (signal: AbortSignal) => Promise<{ terms: CurrentTerms; accepted: boolean } | null>;
  signOut: () => Promise<void>;
};

// Agrega projeções validadas do hospedado. Não substitui RLS/predicados do servidor.
export function createAccessStateSource(ports: AccessPorts) {
  return {
    async read(signal: AbortSignal) {
      const empty = { profile: null, companyStatus: null, terms: null, termsAccepted: false };
      const identity = await ports.identity();
      signal.throwIfAborted();
      if (!identity) return workspaceAccessStateSchema.parse({ ...empty, status: 'signed_out' });
      const profile = await ports.profile(z.uuid().parse(identity.id), signal);
      const state = { ...empty, profile };
      if (
        !profile ||
        profile.id !== identity.id ||
        !profile.active ||
        profile.role === workspaceRole.Partner
      ) {
        return workspaceAccessStateSchema.parse({ ...state, status: 'blocked' });
      }
      const company =
        profile.role === workspaceRole.Client && profile.company_id
          ? await ports.company(profile.company_id, signal)
          : null;
      if (
        profile.role === workspaceRole.Client &&
        (!company ||
          company.id !== profile.company_id ||
          !['active', 'paused'].includes(company.status))
      ) {
        return workspaceAccessStateSchema.parse({ ...state, status: 'blocked' });
      }
      const companyStatus = company?.status ?? null;
      if (profile.role === workspaceRole.Admin && !(await ports.adminMfaReady())) {
        return workspaceAccessStateSchema.parse({
          ...state,
          companyStatus,
          status: 'mfa_required',
        });
      }
      const publication = await ports.termsState(signal);
      signal.throwIfAborted();
      return workspaceAccessStateSchema.parse({
        ...state,
        companyStatus,
        terms: publication?.terms ?? null,
        termsAccepted: publication?.accepted ?? false,
        status: publication
          ? publication.accepted
            ? 'ready'
            : 'terms_required'
          : 'terms_unavailable',
      });
    },
    signOut: ports.signOut,
  };
}
