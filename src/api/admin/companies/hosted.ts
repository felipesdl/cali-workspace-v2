import { createHostedBrand } from './hosted-brand';
import { createHostedAdministration } from './hosted-administration';
import { createPilotReservations } from './pilot-reservations';
import { createHostedRegistration } from './hosted-registration';
import { readHostedCompanyIdentity } from './identity';
import { z } from 'zod';
import { type WorkspaceClient } from '../../supabase';
import {
  companySchema,
  companyDetailsSchema,
  companyAccountSchema,
  companyAccessSchema,
  normalizeCompanyFilters,
  updateCompanyBasicsSchema,
} from './schemas';
import { companyIdentityRecordSchema, clientInviteIdentityRecordSchema } from './records';
import { type CompaniesService } from './service';
import { createCompanyOnboarding } from './onboarding';
import { createHostedCycles, createOpenCurrentCycle, createTransitionServiceCycle } from './cycles';

const companyRecord = companyIdentityRecordSchema.extend({
  service_plan: z.string().nullable(),
  service_type: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});
const inviteRecord = clientInviteIdentityRecordSchema.extend({
  invited_at: z.iso.datetime({ offset: true }).nullable(),
});
const companyFields = 'id,display_name,legal_name,status,service_plan,service_type,created_at';
const inviteFields = 'id,company_id,email,full_name,active,platform_access,is_primary,invited_at';
const unavailable = () => new Error('Não foi possível consultar os dados. Tente novamente.');
function mapCompany(row: z.infer<typeof companyRecord>) {
  const plan = companySchema.shape.plan.safeParse(row.service_plan?.toLowerCase() ?? null);
  return companySchema.parse({
    id: row.id,
    displayName: row.display_name,
    status: row.status,
    plan: plan.data ?? null,
    createdOn: row.created_at.slice(0, 10),
  });
}
export function createHostedCompaniesService(client: WorkspaceClient): CompaniesService {
  return {
    management: null,
    pilotReservations: createPilotReservations(client),
    hostedAdministration: createHostedAdministration(client),
    hostedBrand: createHostedBrand(client),
    hostedRegistration: createHostedRegistration(client),
    onboarding: createCompanyOnboarding(client),
    cycles: createHostedCycles(client),
    openCurrentCycle: createOpenCurrentCycle(client),
    transitionServiceCycle: createTransitionServiceCycle(client),
    async account(companyId, signal) {
      const row = await readHostedCompanyIdentity(client, companyId, signal);
      if (!row) return null;
      return companyAccountSchema.parse({
        id: row.id,
        displayName: row.display_name,
        legalName: row.legal_name,
        status: row.status,
      });
    },
    async list(filters, signal) {
      const normalized = normalizeCompanyFilters(filters);
      const rows: z.infer<typeof companyRecord>[] = [];
      for (let offset = 0; ; offset += 200) {
        signal?.throwIfAborted();
        let query = client
          .from('companies')
          .select(companyFields)
          .order('display_name')
          .order('id')
          .range(offset, offset + 199);
        if (normalized.status !== 'all') query = query.eq('status', normalized.status);
        if (signal) query = query.abortSignal(signal);
        const { data, error } = await query;
        if (error) throw unavailable();
        const page = z.array(companyRecord).parse(data);
        rows.push(...page);
        if (page.length < 200) break;
      }
      return rows
        .map(mapCompany)
        .filter((c) => c.displayName.toLocaleLowerCase('pt-BR').includes(normalized.q));
    },
    async detail(companyId, signal) {
      const id = z.uuid().parse(companyId);
      let query = client.from('companies').select(companyFields).eq('id', id);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query.single();
      if (error) throw unavailable();
      const row = companyRecord.parse(data);
      if (row.id !== id) throw unavailable();
      return companyDetailsSchema.parse({ ...mapCompany(row), legalName: row.legal_name });
    },
    async updateBasics(input) {
      const value = updateCompanyBasicsSchema.parse(input);
      const { data, error } = await client
        .from('companies')
        .update({ display_name: value.values.displayName, legal_name: value.values.legalName })
        .eq('id', value.companyId)
        .eq('display_name', value.expected.displayName)
        .eq('legal_name', value.expected.legalName)
        .select(companyFields)
        .maybeSingle();
      if (error || !data)
        throw new Error(
          'A edição não foi confirmada. Os dados podem ter mudado ou seu acesso não permite esta ação. Recarregue antes de tentar novamente.',
        );
      const row = companyRecord.parse(data);
      if (
        row.id !== value.companyId ||
        row.display_name !== value.values.displayName ||
        row.legal_name !== value.values.legalName
      )
        throw new Error('Não foi possível confirmar a alteração da empresa. Atualize os dados.');
      return companyDetailsSchema.parse({ ...mapCompany(row), legalName: row.legal_name });
    },
    async accesses(companyId, signal) {
      const id = z.uuid().parse(companyId);
      let query = client
        .from('client_invites')
        .select(inviteFields)
        .eq('company_id', id)
        .order('created_at');
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw unavailable();
      return z
        .array(inviteRecord)
        .parse(data)
        .map((row) => {
          if (row.company_id !== id) throw unavailable();
          return companyAccessSchema.parse({
            id: row.id,
            companyId: row.company_id,
            name: row.full_name,
            email: row.email,
            status: row.active && row.platform_access ? 'active' : 'revoked',
            invitedOn: row.invited_at?.slice(0, 10) ?? null,
          });
        });
    },
  };
}
