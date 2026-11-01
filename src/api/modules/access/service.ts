import { z } from 'zod';
import { workspaceAccessStateSchema, type CurrentTerms } from './session';
import { type WorkspaceProfileRecord } from './schemas';
import { type CompanyIdentityRecord } from '../companies/records';

export type AccessPorts = {
  identity: () => Promise<{ id: string } | null>;
  profile: (id: string, signal: AbortSignal) => Promise<WorkspaceProfileRecord | null>;
  company: (id: string, signal: AbortSignal) => Promise<CompanyIdentityRecord | null>;
  adminMfaReady: () => Promise<boolean>;
  currentTerms: () => Promise<CurrentTerms>;
  accepted: (id: string, version: string, signal: AbortSignal) => Promise<boolean>;
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
      if (!profile || profile.id !== identity.id || !profile.active || profile.role === 'partner') {
        return workspaceAccessStateSchema.parse({ ...state, status: 'blocked' });
      }
      const company =
        profile.role === 'client' && profile.company_id
          ? await ports.company(profile.company_id, signal)
          : null;
      if (
        profile.role === 'client' &&
        (!company ||
          company.id !== profile.company_id ||
          !['active', 'paused'].includes(company.status))
      ) {
        return workspaceAccessStateSchema.parse({ ...state, status: 'blocked' });
      }
      const companyStatus = company?.status ?? null;
      if (profile.role === 'admin' && !(await ports.adminMfaReady())) {
        return workspaceAccessStateSchema.parse({
          ...state,
          companyStatus,
          status: 'mfa_required',
        });
      }
      const terms = await ports.currentTerms();
      const termsAccepted = await ports.accepted(profile.id, terms.version, signal);
      signal.throwIfAborted();
      return workspaceAccessStateSchema.parse({
        ...state,
        companyStatus,
        terms,
        termsAccepted,
        status: termsAccepted ? 'ready' : 'terms_required',
      });
    },
    signOut: ports.signOut,
  };
}
